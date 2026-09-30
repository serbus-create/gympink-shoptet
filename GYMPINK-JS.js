(function () {
  'use strict';

  /* ===================================================================
     GYMPINK-JS.js — vlastní JS pro Shoptet
     Verze: 0.4 (+ přesun dvou bannerů pod blok 4 ikon)
     Repo:  github.com/serbus-create/gympink-shoptet
     Vzor:  exalted.com
     ===================================================================

     ZÁSADNÍ PRAVIDLO PRO TENTO PROJEKT:

       Tento skript NIKDY nevkládá obsah.
       Pouze PŘESOUVÁ a PŘESKUPUJE prvky, které už Shoptet vykreslil.

     Důvod: veškerý obsah (fotografie, texty banneru, odkazy) musí
     zůstat plně ovladatelný z administrace Shoptetu. Jakmile bychom
     text nebo cestu k obrázku zapsali sem, klientka by ho už sama
     nezměnila a každá úprava by musela jít přes nás.

     Pokud se objeví požadavek, který jde splnit jen vložením obsahu
     do skriptu — je to signál, že jsme nenašli správný nativní slot
     v administraci. Hledat dál, ne obcházet.

     Druhé pravidlo: selektory se nepíšou naslepo. Každý selektor
     musí vzejít z diagnostiky reálného DOM.
     =================================================================== */


  /* -----------------------------------------------------------------
     POMOCNÉ FUNKCE
     ----------------------------------------------------------------- */

  /**
   * Nový vzhled detailu produktu (PDP2) je zatím jen pro testování:
   * zapíná se na produktu BABY PINK legíny, nebo kdekoli přidáním
   * ?pdp=2 k adrese. Ostatní produkty zůstávají beze změny.
   * Až bude hotovo, stačí funkci změnit na `return true`.
   */
  function jePdp2() {
    return /^\/leginy-baby-pink\/?$/.test(location.pathname) ||
           /[?&]pdp=2(&|$)/.test(location.search);
  }

  /**
   * Bezpečné vyhledání prvku. Vrací null místo vyhození chyby.
   */
  function find(selector, context) {
    try {
      return (context || document).querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  /**
   * Bezpečné vyhledání všech prvků. Vrací vždy pole.
   */
  function findAll(selector, context) {
    try {
      return Array.prototype.slice.call(
        (context || document).querySelectorAll(selector)
      );
    } catch (e) {
      return [];
    }
  }

  /**
   * Bezpečný přesun prvku. Ošetřuje HierarchyRequestError, který
   * nastane při pokusu přesunout rodiče do vlastního potomka —
   * ten by jinak zastavil běh celého skriptu.
   */
  function move(element, target, position) {
    if (!element || !target) return false;
    if (element.contains(target)) {
      log('Přeskočeno — cíl je potomkem přesouvaného prvku.');
      return false;
    }
    try {
      if (position === 'before') {
        target.parentNode.insertBefore(element, target);
      } else if (position === 'after') {
        target.parentNode.insertBefore(element, target.nextSibling);
      } else {
        target.appendChild(element);
      }
      return true;
    } catch (e) {
      log('Přesun selhal: ' + e.message);
      return false;
    }
  }

  /**
   * Ladicí výpis. Zapne se přidáním ?gpdebug=1 do adresy stránky.
   */
  var DEBUG = window.location.search.indexOf('gpdebug=1') !== -1;

  function log(message) {
    if (DEBUG && window.console) console.log('[gympink] ' + message);
  }


  /* -----------------------------------------------------------------
     JEDNOTLIVÉ ÚPRAVY
     Doplní se postupně po diagnostice DOM.
     ----------------------------------------------------------------- */

  var upravy = [

    {
      nazev: 'Scroll efekt hlavičky (průhledná → bílá po 60% hero fotky)',
      spustit: function () {
        // Jen titulní strana — stejné omezení jako v CSS (body.type-index).
        if (!document.body.classList.contains('type-index')) return;

        var header = find('#header');
        var hero = find('.wide-carousel');
        if (!header || !hero) return;

        var ticking = false;

        function aktualizovat() {
          var vyskaHero = hero.getBoundingClientRect().height;
          var hranice = vyskaHero * 0.6;
          var maZaScrollovano = window.scrollY > hranice;
          header.classList.toggle('gp-scrolled', maZaScrollovano);
          ticking = false;
        }

        window.addEventListener('scroll', function () {
          if (!ticking) {
            window.requestAnimationFrame(aktualizovat);
            ticking = true;
          }
        }, { passive: true });

        // Pojistka: stránka může být načtená už uprostřed scrollu
        // (např. reload), ať se hlavička rovnou zobrazí ve správném stavu.
        aktualizovat();
      }
    },

    {
      nazev: 'Přesun odkazu Blog z kategorií do pravého horního rohu hlavičky',
      spustit: function () {
        // Hlavička je teď kompaktní na celém webu (ne jen homepage),
        // takže i tenhle přesun platí všude — bez omezení na type-index.
        var odkazBlog = find('#navigation .menu-level-1 a[href*="/blog"]');
        var ikonyVpravo = find('.top-nav-right');
        if (!odkazBlog || !ikonyVpravo) return;

        var polozkaBlog = odkazBlog.closest('li') || odkazBlog;
        if (polozkaBlog.classList.contains('gp-blog-moved')) return; // už přesunuto

        polozkaBlog.classList.add('gp-blog-moved');

        // .top-nav-right je pravděpodobně position:absolute (mimo
        // normální tok), takže vložení JAKO SOUROZENEC před něj
        // nefungovalo — Blog zůstával v normálním toku hned za
        // logem. Řešení: vložit přímo DOVNITŘ, jako první prvek ve
        // stejném řádku s ikonami.
        ikonyVpravo.insertBefore(polozkaBlog, ikonyVpravo.firstChild);
      }
    },

    {
      nazev: 'Kompenzace pevné hlavičky na podstránkách (žádná hero fotka pod ní)',
      spustit: function () {
        // Na homepage leží hlavička nad hero fotkou, není potřeba
        // nic odsazovat. Na ostatních stránkách (kategorie, produkt,
        // košík…) by obsah bez odsazení zajel pod position:fixed
        // hlavičku — odsazení měříme přímo, ne odhadem.
        if (document.body.classList.contains('type-index')) return;

        var hlavicka = find('#header');
        var obsah = find('#content-wrapper') || find('main#content');
        if (!hlavicka || !obsah) return;

        function odsadit() {
          var vyska = hlavicka.getBoundingClientRect().height;
          obsah.style.setProperty('padding-top', (vyska + 4) + 'px', 'important');
        }

        odsadit();
        window.addEventListener('resize', odsadit);
        window.addEventListener('load', odsadit);
      }
    },

    {
      nazev: 'Přesun bloku se 4 ikonami (benefitBanner) hned pod hero banner',
      spustit: function () {
        // Jen titulní strana.
        if (!document.body.classList.contains('type-index')) return;

        var hero = find('.wide-carousel');
        var benefity = find('.benefitBanner.position--benefitHomepage');
        if (!hero || !benefity) return;

        move(benefity, hero, 'after');
      }
    },

    {
      nazev: 'Rozdělení bannerů Zápatí na pár (Bestsellers/Novinky) a velký (Týmové oblečení)',
      spustit: function () {
        if (!document.body.classList.contains('type-index')) return;

        var benefity = find('.benefitBanner.position--benefitHomepage');
        var bannery = find('.footer-banners.row.banner-wrapper');
        if (!benefity || !bannery) return;

        var vsechny = findAll('.footer-banner', bannery);
        if (vsechny.length < 2) return;

        // Poslední banner v pořadí administrace = velký, zůstává dole u patičky.
        var velky = vsechny[vsechny.length - 1];
        velky.classList.add('gp-banner-big');

        // Předchozí bannery = malý pár, přesune se pod blok ikon.
        var par = vsechny.slice(0, -1);
        var wrap = document.createElement('div');
        wrap.className = 'gp-banner-pair';
        par.forEach(function (el) {
          el.classList.add('gp-banner-pair-item');
          wrap.appendChild(el);
        });

        move(wrap, benefity, 'after');

        // Velký banner musí mít STEJNÉ zarovnání/šířku jako pár nad
        // ním — to jde spolehlivě jen na stejné úrovni DOM (pár sedí
        // mimo hluboko zanořený .container, který má na širokých
        // obrazovkách vlastní pevnou šířku a centruje se jinak).
        // Wrapper s identickým paddingem (0 32px) jako .gp-banner-pair
        // zaručí stejné okraje.
        var wrapVelky = document.createElement('div');
        wrapVelky.className = 'gp-banner-big-wrap';
        wrapVelky.appendChild(velky);
        move(wrapVelky, wrap, 'after');

        // Po přesunu obou skupin je .footer-banners prázdný — schovat,
        // ať nezůstává jako neviditelný blok s případným nativním
        // paddingem/výškou.
        bannery.style.display = 'none';
      }
    },

    {
      nazev: 'Logo GymPink v levém horním rohu patičky (odkaz na domovskou stránku)',
      spustit: function () {
        // Patička je na všech typech stránek — bez omezení na type-index.
        var paticka = find('footer.footer');
        var zdrojoveLogo = find('.site-name img');
        if (!paticka || !zdrojoveLogo) return;
        if (find('.gp-footer-logo', paticka)) return; // už tam je, neduplikovat

        // Znovupoužijeme existující logo z hlavičky (ne nový obsah —
        // stejný obrázek, který klientka ovládá v administraci).
        var odkaz = document.createElement('a');
        odkaz.href = '/';
        odkaz.className = 'gp-footer-logo';
        odkaz.setAttribute('aria-label', 'GymPink — domů');

        var obrazek = document.createElement('img');
        obrazek.src = zdrojoveLogo.currentSrc || zdrojoveLogo.src;
        obrazek.alt = zdrojoveLogo.alt || 'GymPink';

        odkaz.appendChild(obrazek);
        paticka.insertBefore(odkaz, paticka.firstChild);

        // Zarovnání nalevo přesně podle prvního sloupce (Kontakt) —
        // ten má svůj vlastní vnitřní odstup (Bootstrap gutter) navíc
        // k paddingu patičky, takže pevná hodnota by seděla jen
        // náhodou. Změřeno přímo, ne odhadem.
        function zarovnat() {
          var prvniSloupec = find('.custom-footer > *', paticka);
          if (!prvniSloupec) return;
          var offset = prvniSloupec.getBoundingClientRect().left - paticka.getBoundingClientRect().left;
          odkaz.style.setProperty('left', offset + 'px', 'important');
        }

        zarovnat();
        window.addEventListener('resize', zarovnat);
      }
    },

    {
      nazev: 'Detail produktu — layout nadpis/obrázek/formulář (inline !important, obchází CSS specificitu šablony)',
      spustit: function () {
        // Několik čistě CSS pokusů (flex/float/clearfix, i s vyšší
        // specificitou #content jako kotvou) se ukázalo nespolehlivých
        // — pozice se neměnila, i když se ostatní pravidla (cena,
        // tlačítko) evidentně aplikovala. Nativní styl šablony na
        // pozici zjevně vyhrával. Řešení: nastavit přímo na
        // konkrétní prvky přes inline style + 'important' — to vždy
        // vyhraje nad jakýmkoliv externím CSS pravidlem bez ohledu
        // na jeho specificitu.
        //
        // DŮLEŽITÉ: hledání "prvního .row" bylo nespolehlivé — na
        // některých produktech obsahuje krátký popis (POBO) vlastní
        // .row dřív v DOM, než je ten se skutečným nadpisem/obrázkem,
        // takže se JS chytil špatného .row a celý krok se přeskočil.
        // Místo toho cílíme přímo na konkrétní prvky přes jejich
        // vlastní specifické třídy — nezávisle na tom, kde přesně
        // v DOM leží jejich obalující .row.
        var inner = find('.p-detail-inner');
        if (!inner) return;

        // Nový vzhled detailu (PDP2) si layout řídí sám.
        if (document.body.classList.contains('gp-pdp2')) return;

        // Layout níž se nastavuje inline s !important, což přebije
        // i media queries — na mobilu bychom pak nemohli nic upravit
        // a vynucené šířky (max-width:340px, flex-basis:500px) tam
        // nedávají smysl. Pod 901 px proto necháváme nativní skládání
        // Shoptetu (prvky pod sebou).
        if (window.innerWidth <= 900) return;

        var obrazekSloupec = find('.detail-img.p-image-wrapper', inner);
        var formSloupec = find(':scope > .col-md-4.pull-left', inner) || find('.col-md-4.pull-left', inner);
        var nadpisElement = find('h1', inner);
        var nadpisSloupec = nadpisElement ? nadpisElement.closest('.col-md-4') : null;
        var radek = obrazekSloupec ? obrazekSloupec.parentElement : null;

        if (!radek || !nadpisSloupec || !obrazekSloupec || !formSloupec) return;
        // Bezpečnostní pojistka: pokud "formSloupec" omylem vyšel
        // jako potomek "radek" (špatná shoda), nic nedělat.
        if (radek.contains(formSloupec)) return;

        function vynutit(el, styly) {
          if (!el) return;
          Object.keys(styly).forEach(function (vlastnost) {
            el.style.setProperty(vlastnost, styly[vlastnost], 'important');
          });
        }

        vynutit(inner, { display: 'block' });
        vynutit(radek, {
          display: 'flex',
          'flex-wrap': 'wrap',
          'align-items': 'flex-start',
          gap: '32px',
          margin: '0',
          overflow: 'hidden'
        });
        vynutit(nadpisSloupec, {
          float: 'none',
          flex: '1 1 300px',
          'max-width': '340px',
          width: 'auto',
          padding: '0'
        });
        vynutit(obrazekSloupec, {
          float: 'none',
          flex: '3 1 500px',
          width: 'auto',
          'max-width': '100%',
          padding: '0'
        });
        vynutit(formSloupec, {
          display: 'block',
          clear: 'both',
          float: 'none',
          width: '100%',
          'max-width': '340px',
          padding: '0',
          margin: '24px 0 0'
        });
      }
    },

    {
      nazev: 'Kategorie — filtr na řádku s Řadit podle (ŘEŠENO V CSS, krok vypnutý)',
      spustit: function () {
        // Dřív tenhle krok přesouval #filters-wrapper do #category-header.
        // Problém: Shoptet si po aplikaci filtru blok sám překreslí,
        // čímž přesun zahodil a layout se rozpadl (filtr skočil
        // doprostřed stránky). Přesouvat ho znovu přes MutationObserver
        // by znamenalo trvale se přetahovat se Shoptetem.
        // Řešení: layout se dělá čistě CSS přes flex `order` na
        // .category-content-wrapper (viz CSS sekce 3.11), takže na
        // fyzickém umístění v DOM nezáleží a překreslení nevadí.
        return;
      }
    },

    {
      nazev: 'Zvýrazněný produkt (.highlight-product) — sundat speciální třídy, ať vypadá jako běžná karta',
      spustit: function () {
        // Opakované cílené CSS opravy (layout, mezery, pozadí) pořád
        // nechytily úplně všechno, co Shoptet nativně stylizuje pro
        // .highlight-product jinak. Radikálnější, spolehlivější
        // řešení: sundat mu rovnou speciální třídy, ať je pro
        // šablonu k nerozeznání od běžné karty.
        var zvyraznene = findAll('.product.highlight-product');
        zvyraznene.forEach(function (el) {
          el.classList.remove('highlight-product');
          el.classList.remove('js-product-clickable');
          el.classList.remove('col-md-8');
          el.classList.add('col-md-4');

          // Prázdný .short-descr, který má jen tenhle produkt navíc,
          // způsoboval mezeru u ceny. Po sundání třídy už na něj
          // nesedí CSS pravidlo (.highlight-product .short-descr),
          // proto ho rovnou odstraníme z DOM.
          var shortDescr = find('.short-descr', el);
          if (shortDescr) shortDescr.remove();
        });
      }
    },

    {
      nazev: 'POBO popis — rozbalit špatně zanořené widgety a smazat prázdné',
      spustit: function () {
        // Jen DESKTOP. Na mobilu jsme se rozhodli detail produktu
        // vůbec neupravovat (viz CSS, konec souboru) — nativní
        // šablona ať si POBO obsah vykreslí po svém.
        if (window.innerWidth <= 900) return;

        // Diagnostika (HTML zdroj popisu): widget "advantages-four" je
        // mřížka 4 sloupečků, kde .rc-advantages-four__ico-container je
        // políčko pro MALOU IKONU. V tomhle produktu do něj někdo vnořil
        // celé další widgety (image-right > image-half-left "Proč si je
        // zamiluješ?", text "Barva přímo na míru", faq). Obsah na několik
        // obrazovek se tak cpe do ~25 % šířky mřížky → text se drtí a
        // překrývá. Žádné CSS to nespraví, musí se rozebrat struktura.
        // Navíc tam jsou widgety obsahující jen &nbsp; → prázdné díry.
        var koren = find('#pobo-all-content');
        if (!koren) return;

        // 1) Vytáhnout widgety zanořené v políčku pro ikonu ven.
        //    Vkládáme je ZA celý widget-container, ve kterém vězely,
        //    aby zůstalo pořadí obsahu tak, jak ho klientka zamýšlela.
        var ikonky = findAll('.rc-advantages-four__ico-container', koren);
        ikonky.forEach(function (ikona) {
          var vnorene = findAll(':scope > .widget-container', ikona);
          if (!vnorene.length) return;

          var hostitel = ikona.closest('.widget-container');
          if (!hostitel || !hostitel.parentElement) return;

          vnorene.forEach(function (w) {
            hostitel.parentElement.insertBefore(w, hostitel.nextSibling);
          });
        });

        // 2) Smazat widgety bez obsahu (jen &nbsp; / mezery).
        //    Pojistka: widget s obrázkem/videem se nemaže, i kdyby
        //    neměl žádný text.
        findAll('.widget-container', koren).forEach(function (w) {
          var maMedia = w.querySelector('img, video, iframe, picture, svg');
          if (maMedia) return;

          // \u00a0 = nezlomitelná mezera (&nbsp;)
          var text = (w.textContent || '').replace(/\u00a0/g, ' ').trim();
          if (text === '') w.remove();
        });
      }
    },

    {
      nazev: 'POBO popis — mobilní úklid inline rozměrů (ŘEŠENÍ ZRUŠENO, krok vypnutý)',
      spustit: function () {
        // Zrušeno: na mobilu se objevil neviditelný prvek, co kradl
        // kliky na tlačítko Do košíku (viz historie Gitu, sekce 3.17–
        // 3.22 v CSS). Nepodařilo se spolehlivě najít viníka, tak
        // jsme se rozhodli mobil na detailu produktu vůbec
        // neupravovat a nechat nativní chování šablony Tango.
        return;
      }
    },

    {
      nazev: 'Homepage — skupina produktů jako vodorovný pás (nadpis + Zobrazit vše + šipky)',
      spustit: function () {
        if (!document.body.classList.contains('type-index')) return;

        // Skupiny produktů na titulní straně: #products-1, #products-2, ...
        findAll('.products-inline[class*="homepage-products-"]').forEach(function (skupina) {
          if (skupina.closest('.gp-drop')) return; // už zpracováno

          // Nadpis skupiny: nejdřív podle čísla skupiny (products-N →
          // homepage-products-heading-N), pak nejbližší předchozí
          // sourozenec .homepage-group-title.
          var nadpis = null;
          var cislo = (skupina.id || '').replace(/^products-/, '');
          if (cislo) {
            nadpis = find('.homepage-products-heading-' + cislo, skupina.parentNode);
          }
          if (!nadpis) {
            var sus = skupina.previousElementSibling;
            while (sus && !sus.classList.contains('homepage-group-title')) {
              sus = sus.previousElementSibling;
            }
            nadpis = sus || null;
          }

          // Obal: [hlavička: nadpis + nástroje] + pás produktů
          var obal = document.createElement('div');
          obal.className = 'gp-drop';
          skupina.parentNode.insertBefore(obal, nadpis || skupina);

          var hlavicka = document.createElement('div');
          hlavicka.className = 'gp-drop-head';
          obal.appendChild(hlavicka);
          if (nadpis) {
            hlavicka.appendChild(nadpis);
            // Inline !important — nativní pravidla šablony nadpis přebíjela.
            ['display:block', 'visibility:visible', 'position:static',
             'opacity:1', 'height:auto', 'width:auto', 'float:none']
              .forEach(function (d) {
                var kv = d.split(':');
                nadpis.style.setProperty(kv[0], kv[1], 'important');
              });
          }

          // Nástroje vpravo. Odkaz "Zobrazit vše" míří na /novinky/ —
          // JEDINÁ pevně zapsaná hodnota (ovládací prvek, ne obsah).
          var nastroje = document.createElement('div');
          nastroje.className = 'gp-drop-tools';

          var vse = document.createElement('a');
          vse.className = 'gp-drop-all';
          vse.href = '/novinky/';
          vse.textContent = 'Zobrazit vše';
          nastroje.appendChild(vse);

          function tlacitko(trida, popisek, znak) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'gp-drop-arrow ' + trida;
            b.setAttribute('aria-label', popisek);
            b.innerHTML = znak;
            return b;
          }
          var zpet = tlacitko('gp-drop-prev', 'Předchozí produkty',
            '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1L1 7l6 6"/></svg>');
          var dal = tlacitko('gp-drop-next', 'Další produkty',
            '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l6 6-6 6"/></svg>');
          nastroje.appendChild(zpet);
          nastroje.appendChild(dal);
          hlavicka.appendChild(nastroje);

          obal.appendChild(skupina);

          // Pořadí na titulní straně: malý pár bannerů → tato sekce →
          // velký banner (Týmové oblečení). Pár i velký banner už
          // vytvořil předchozí krok; sekci vložíme hned za pár.
          var parBanneru = find('.gp-banner-pair');
          if (parBanneru && !skupina.id.match(/^products-(?!1$)/)) {
            move(obal, parBanneru, 'after');
          }

          // Fotky: vyplnit celou kartu (nativní pravidlo je nechávalo
          // v režimu "contain" s bílými pruhy po stranách).
          findAll('a.image img', skupina).forEach(function (img) {
            [['width', '100%'], ['height', '100%'], ['max-width', 'none'],
             ['max-height', 'none'], ['object-fit', 'cover'],
             ['object-position', 'center'], ['margin', '0'], ['padding', '0']]
              .forEach(function (kv) { img.style.setProperty(kv[0], kv[1], 'important'); });
          });

          function krok() { return Math.max(200, Math.round(skupina.clientWidth * 0.8)); }
          zpet.addEventListener('click', function () {
            skupina.scrollBy({ left: -krok(), behavior: 'smooth' });
          });
          dal.addEventListener('click', function () {
            skupina.scrollBy({ left: krok(), behavior: 'smooth' });
          });

          function stav() {
            var max = skupina.scrollWidth - skupina.clientWidth - 2;
            zpet.disabled = skupina.scrollLeft <= 2;
            dal.disabled = skupina.scrollLeft >= max;
            zpet.style.opacity = zpet.disabled ? '.35' : '1';
            dal.style.opacity = dal.disabled ? '.35' : '1';
          }
          skupina.addEventListener('scroll', stav, { passive: true });
          window.addEventListener('resize', stav);
          stav();
        });
      }
    },

    {
      nazev: 'Ostré fotky produktů — miniatura 423×318 nahrazena velkou verzí (1024×768) z data-micro-image',
      spustit: function () {
        // Diagnostika (DevTools): <img> má width=423 height=318 a v atributu
        // data-micro-image adresu VELKÉ verze (/user/shop/big/…&x=1024&y=768
        // s platným podpisem sg=). Miniatura 423×318 je krajinné plátno,
        // do kterého Shoptet vloží portrétní fotku s bílými okraji →
        // po roztažení do karty je malá, rozmazaná a odsazená od okraje.
        // URL nikam nezapisujeme, bereme ji, co Shoptet sám vykreslil.
        findAll('.product').forEach(function (karta) {
          var img = find('a.image img, .img img', karta);
          if (!img || img.getAttribute('data-gp-big')) return;

          var url = img.getAttribute('data-micro-image') || '';
          if (!url) {
            var meta = find('meta[itemprop="image"]', karta);
            url = meta ? (meta.getAttribute('content') || '') : '';
          }
          if (!url || url.indexOf('/user/shop/big/') === -1) return;

          var puvodni = img.currentSrc || img.src;
          img.setAttribute('data-gp-big', '1');

          // Kdyby velká verze selhala, vrátit původní miniaturu (jednou).
          function zaloha() {
            img.removeEventListener('error', zaloha);
            img.removeAttribute('srcset');
            img.src = puvodni;
          }
          img.addEventListener('error', zaloha);

          img.removeAttribute('srcset');
          img.removeAttribute('data-srcset');
          img.setAttribute('data-src', url);
          img.src = url;
        });
      }
    },

    {
      nazev: 'Příznaky (varianta A) — přesun .flags-inline do rohu fotky (.img)',
      spustit: function () {
        // Diagnostika (DevTools, výpis kategorie): .product > .inner >
        //   .img (a > img, div.flags.flags-extra)   ← fotka + prázdný slot
        //   .flags.flags-inline                       ← skutečné štítky, mimo fotku
        //   .descr
        // Štítky přesuneme do .flags-extra uvnitř .img, ať se dají v CSS
        // umístit přesně do levého horního rohu fotky.
        findAll('.product .inner').forEach(function (inner) {
          var foto = find('.img', inner);
          var inline = find('.flags-inline', inner);
          if (!foto || !inline || foto.contains(inline)) return;

          var slot = find('.flags-extra', foto);
          if (!slot) {
            foto.appendChild(inline);
          } else {
            while (inline.firstChild) slot.appendChild(inline.firstChild);
            inline.style.setProperty('display', 'none', 'important');
          }
        });

        // Šablona vynucuje štítkům pevnou výšku (na fotce vznikl černý
        // čtverec ~70 px). Inline !important vyhraje nad jakýmkoli
        // pravidlem, takže výšku a roztažení vynulujeme přímo na prvcích.
        function vynulujRozmery(el) {
          [['width', 'auto'], ['height', 'auto'], ['min-width', '0'],
           ['min-height', '0'], ['max-width', 'none'], ['max-height', 'none'],
           ['aspect-ratio', 'auto'], ['flex', '0 0 auto'],
           ['align-self', 'flex-start']]
            .forEach(function (kv) { el.style.setProperty(kv[0], kv[1], 'important'); });
        }
        findAll('.product .img .flags, .product .img .flags-extra, ' +
                '.product a.image .extra-flags, .product a.image .flags')
          .forEach(function (kontejner) {
            vynulujRozmery(kontejner);
            Array.prototype.slice.call(kontejner.children).forEach(vynulujRozmery);
          });
      }
    },

    {
      nazev: 'Kategorie — odstranit vodorovné odsazení karty (mezi fotkami jen mezera z CSS)',
      spustit: function () {
        // Diagnostika (měření screenshotu /leginy/): mezera mezi fotkami je
        // ~35 px, ačkoli mřížka má gap 4 px. Zbylých ~2×15 px je uvnitř
        // karty (Bootstrap gutter col-md-4) — přebíjí naše CSS na některém
        // prvku v řetězci .product > .inner > .img. Protože nevíme na kterém,
        // vynulujeme vodorovný padding/margin na celé cestě od .img nahoru
        // ke kartě inline !important (to vyhraje vždy).
        function nuluj(el, vcetneSirky) {
          ['padding-left', 'padding-right', 'margin-left', 'margin-right']
            .forEach(function (v) { el.style.setProperty(v, '0', 'important'); });
          if (vcetneSirky) {
            el.style.setProperty('width', '100%', 'important');
            el.style.setProperty('max-width', 'none', 'important');
          }
        }
        findAll('#products.products-block > .product, .products-block > .product')
          .forEach(function (karta) {
            var foto = find('.img', karta);
            if (!foto) return;
            var el = foto;
            while (el && el !== karta) {
              nuluj(el, true);
              el = el.parentElement;
            }
            nuluj(karta, false); // šířku karty řídí flex-basis z CSS
          });
      }
    },

    {
      nazev: 'Detail produktu 2 (PDP2) — mřížka galerie/panel, značky tříd, řádek důvěry',
      spustit: function () {
        if (!document.body.classList.contains('gp-pdp2')) return;
        var inner = find('.p-detail-inner');
        if (!inner) return;

        var galerie = find('.detail-img.p-image-wrapper', inner);
        var nadpis = find('h1', inner);
        var cenaRadek = find('.price.row', inner);
        if (!galerie || !nadpis || !cenaRadek) {
          log('PDP2 přeskočeno, nenalezeno: ' +
              (!galerie ? '[galerie .detail-img.p-image-wrapper] ' : '') +
              (!nadpis ? '[h1] ' : '') +
              (!cenaRadek ? '[.price.row] ' : ''));
          return;
        }

        var radek = galerie.parentElement;
        if (!radek || radek === inner) {
          log('PDP2 přeskočeno: rodič galerie je přímo .p-detail-inner');
          return;
        }

        // Dva možné tvary stránky (po vypnutí POBO se objevil ten první):
        //  B) nadpis I formulář (cena, tlačítko) jsou v JEDNOM sloupci uvnitř
        //     řádku vedle galerie → mřížka na samotném řádku.
        //  A) nadpis je v řádku, formulář je samostatný sloupec mimo řádek
        //     → mřížka na .p-detail-inner (display: contents na řádku).
        var info = Array.prototype.slice.call(radek.children).filter(function (d) {
          return d.contains(nadpis);
        })[0] || null;
        var rezimB = !!(info && info !== galerie && info.contains(cenaRadek));

        var nakup = null;
        if (!rezimB) {
          nakup = cenaRadek.closest('.col-md-4') || cenaRadek.parentElement;
          if (!nakup || nakup === info || radek.contains(nakup)) {
            log('PDP2 přeskočeno: nepodařilo se určit sloupec formuláře');
            return;
          }
        }
        log('PDP2 režim ' + (rezimB ? 'B (nadpis i formulář v jednom sloupci)' : 'A (formulář zvlášť)'));
        inner.classList.add(rezimB ? 'gp-pdp-modeB' : 'gp-pdp-modeA');

        var zalozky = find(':scope > .shp-tabs-wrapper', inner) || find('.shp-tabs-wrapper', inner);

        // Značky tříd — CSS se opírá o ně, ne o křehké .row / .col-md-4.
        galerie.classList.add('gp-pdp-gallery');
        if (rezimB) {
          radek.classList.add('gp-pdp-row2');
          info.classList.add('gp-pdp-info');
        } else {
          radek.classList.add('gp-pdp-row');
          if (info) info.classList.add('gp-pdp-title');
          nakup.classList.add('gp-pdp-buy');
          if (zalozky) zalozky.classList.add('gp-pdp-tabs');
        }

        // Hlavní fotka galerie (první <img>, který není miniatura).
        var hlavniFoto = findAll('img', galerie).filter(function (i) {
          return !i.closest('.p-thumbnails, .p-thumbnails-wrapper, .p-thumbnail');
        })[0];
        if (hlavniFoto) hlavniFoto.classList.add('gp-pdp-main-img');

        // ----- Řádek důvěry pod tlačítkem -----
        // JEDINÁ výjimka z pravidla "JS nevkládá obsah": krátké pevné
        // položky. Jsou zapsané tady v poli, ať jdou snadno upravit.
        // Pouze ověřitelná tvrzení (14 dní na vrácení = zákonné právo
        // spotřebitele; platby = e-shop přijímá online platby).
        var DUVERA = [
          { href: '/doprava-a-platby/', text: 'Doprava a platby',
            ikona: '<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0M5 17H3V6a1 1 0 0 1 1-1h9v12M9 17h6M19 17h2v-6h-8M13 6h5l3 5"/>' },
          { text: '14 dní na vrácení',
            ikona: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/>' },
          { text: 'Bezpečná online platba',
            ikona: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1-8.5 15a12 12 0 0 1-8.5-15A12 12 0 0 0 12 3M11 11a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 12v2.5"/>' }
        ];
        if (!find('.gp-trust', inner)) {
          var seznam = document.createElement('ul');
          seznam.className = 'gp-trust';
          DUVERA.forEach(function (d) {
            var li = document.createElement('li');
            var svg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d.ikona + '</svg>';
            li.innerHTML = d.href
              ? '<a href="' + d.href + '">' + svg + '<span>' + d.text + '</span></a>'
              : svg + '<span>' + d.text + '</span>';
            seznam.appendChild(li);
          });
          if (cenaRadek.parentNode) {
            cenaRadek.parentNode.insertBefore(seznam, cenaRadek.nextSibling);
          }
        }

        // ----- Mřížka: inline !important jen na desktopu, s úklidem při zúžení -----
        var nastaveni = [];
        function vynutit(el, styly) {
          if (!el) return;
          Object.keys(styly).forEach(function (v) {
            el.style.setProperty(v, styly[v], 'important');
            nastaveni.push([el, v]);
          });
        }
        function uklidit() {
          nastaveni.forEach(function (n) { n[0].style.removeProperty(n[1]); });
          nastaveni = [];
        }
        function aplikuj() {
          uklidit();
          if (window.innerWidth <= 900) return; // mobil: nativní chování šablony

          var nadpisStyl = {
            'font-size': '26px', 'font-weight': '500', 'line-height': '1.2',
            'text-transform': 'none', margin: '0 0 8px'
          };

          if (rezimB) {
            vynutit(radek, {
              display: 'grid',
              'grid-template-columns': 'minmax(0, .85fr) minmax(0, 1.15fr)',
              'column-gap': '40px',
              'align-items': 'start',
              overflow: 'visible',
              margin: '0'
            });
            vynutit(galerie, {
              'grid-column': '1', 'grid-row': '1',
              float: 'none', width: 'auto', 'max-width': 'none',
              padding: '0', margin: '0', position: 'relative'
            });
            vynutit(info, {
              'grid-column': '2', 'grid-row': '1',
              float: 'none', width: 'auto', 'max-width': 'none',
              padding: '0', margin: '0'
            });
            vynutit(nadpis, nadpisStyl);
          } else {
            vynutit(inner, {
              display: 'grid',
              'grid-template-columns': 'minmax(0, .85fr) minmax(0, 1.15fr)',
              'column-gap': '40px',
              'align-items': 'start',
              position: 'relative'
            });
            vynutit(radek, { display: 'contents' });
            if (info) vynutit(info, { display: 'contents' });
            vynutit(galerie, {
              'grid-column': '1', 'grid-row': '1 / span 3',
              float: 'none', width: 'auto', 'max-width': 'none',
              padding: '0', margin: '0'
            });
            vynutit(nadpis, {
              'grid-column': '2', 'grid-row': '1',
              'font-size': nadpisStyl['font-size'], 'font-weight': '500',
              'line-height': '1.2', 'text-transform': 'none', margin: '0 0 8px'
            });
            vynutit(nakup, {
              'grid-column': '2', 'grid-row': '2',
              float: 'none', width: 'auto', 'max-width': 'none',
              padding: '0', margin: '0', display: 'block', clear: 'none'
            });
            if (zalozky) vynutit(zalozky, { 'grid-column': '1 / -1', 'grid-row': '4' });
          }
        }
        aplikuj();
        window.addEventListener('resize', aplikuj);
      }
    },

  ];


  /* -----------------------------------------------------------------
     SPUŠTĚNÍ
     ----------------------------------------------------------------- */

  function spustit() {
    log('Start, úprav k provedení: ' + upravy.length);

    // Třída musí být na <body> dřív, než proběhne první úprava detailu.
    if (jePdp2() && find('.p-detail-inner')) {
      document.body.classList.add('gp-pdp2');
    }

    upravy.forEach(function (uprava) {
      try {
        uprava.spustit();
        log('OK — ' + uprava.nazev);
      } catch (e) {
        // Chyba v jedné úpravě nesmí zastavit ostatní.
        log('CHYBA — ' + uprava.nazev + ': ' + e.message);
      }
    });

    // Odkrytí stránky (anti-FOUC) — viz <head> blok v administraci.
    if (window.__checkReady) window.__checkReady();

    log('Hotovo.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', spustit);
  } else {
    spustit();
  }

})();
