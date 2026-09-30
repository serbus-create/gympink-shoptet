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
   * Nový vzhled detailu produktu (PDP2) platí pro VŠECHNY produkty.
   * Záchranná pojistka: přidáním ?pdp=0 k adrese produktu se zobrazí
   * původní vzhled (pro porovnání / když se u konkrétního produktu něco
   * rozbije). Třída se navíc dává jen tam, kde existuje .p-detail-inner.
   */
  function jePdp2() {
    return !/[?&]pdp=0(&|$)/.test(location.search);
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
        // Od varianty E logo v patičce nahrazuje claim (viz krok "Zápatí").
        // Krok necháváme kvůli historii, ale nic nevkládá.
        return;
        // eslint-disable-next-line no-unreachable
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
        document.documentElement.setAttribute('data-gp-pdp2', 'lca-1'); // značka verze kroku

        // ----- Nalezení prvků -----
        var galerie = find('.detail-img.p-image-wrapper') || find('.p-image-wrapper') || find('.detail-img');
        var cenaRadek = find('.p-detail-inner .price.row') || find('.price.row');
        var nadpis = find('.p-detail-inner h1') || find('h1');
        if (!galerie || !cenaRadek || !nadpis) {
          log('PDP2 přeskočeno, nenalezeno: ' +
              (!galerie ? '[galerie] ' : '') + (!cenaRadek ? '[.price.row] ' : '') + (!nadpis ? '[h1] ' : ''));
          return;
        }

        // Nejbližší společný rodič galerie a bloku s cenou = kontejner mřížky.
        function spolecnyRodic(a, b) {
          var p = a.parentElement;
          while (p && !p.contains(b)) p = p.parentElement;
          return p;
        }
        function potomekObsahujici(rodic, uzel) {
          var n = uzel;
          while (n && n.parentElement !== rodic) n = n.parentElement;
          return n;
        }
        function predkoviDo(el, rodic) { // předkové el až po rodiče (bez něj)
          var out = [];
          var n = el.parentElement;
          while (n && n !== rodic) { out.push(n); n = n.parentElement; }
          return out;
        }

        var L = spolecnyRodic(galerie, cenaRadek);
        if (!L) { log('PDP2 přeskočeno: galerie a cena nemají společného rodiče'); return; }
        var gb = potomekObsahujici(L, galerie);   // větev s galerií
        var pb = potomekObsahujici(L, cenaRadek); // větev s cenou/formulářem
        if (!gb || !pb || gb === pb) { log('PDP2 přeskočeno: větve galerie a ceny splývají'); return; }

        var rezimB = pb.contains(nadpis); // B: nadpis je ve stejném sloupci jako formulář
        log('PDP2 režim ' + (rezimB ? 'B' : 'A') + ' | kontejner: ' + L.tagName.toLowerCase() +
            '.' + String(L.className).trim().replace(/\s+/g, '.') +
            ' | galerie větev: ' + gb.tagName.toLowerCase() + '.' + String(gb.className).trim().replace(/\s+/g, '.') +
            ' | panel větev: ' + pb.tagName.toLowerCase() + '.' + String(pb.className).trim().replace(/\s+/g, '.'));

        var zalozky = find(':scope > .shp-tabs-wrapper', L) || find('.shp-tabs-wrapper');
        if (zalozky && !L.contains(zalozky)) zalozky = null;

        // ----- Třídy pro CSS -----
        gb.classList.add('gp-pdp-gallery');
        pb.classList.add(rezimB ? 'gp-pdp-info' : 'gp-pdp-buy');
        L.classList.add(rezimB ? 'gp-pdp-row2' : 'gp-pdp-modeA');
        if (!rezimB && zalozky) zalozky.classList.add('gp-pdp-tabs');

        // Hlavní fotka galerie = největší vykreslený <img>; miniatury = malé <img>
        // (do 15 % plochy hlavní fotky). Nezávisí na názvech tříd šablony.
        var obrazky = findAll('img', galerie);
        function plochaObr(i) {
          var r = i.getBoundingClientRect();
          return r.width * r.height;
        }
        var hlavniFoto = obrazky.slice().sort(function (a, b) {
          return plochaObr(b) - plochaObr(a);
        })[0] || null;
        if (hlavniFoto) hlavniFoto.classList.add('gp-pdp-main-img');
        var hlavniPlocha = hlavniFoto ? plochaObr(hlavniFoto) : 0;

        var miniatury = [];
        obrazky.forEach(function (i) {
          var pl = plochaObr(i);
          if (i === hlavniFoto || pl <= 0 || pl >= hlavniPlocha * 0.15) return;
          var a = i.closest('a') || i;
          if (galerie.contains(a) && miniatury.indexOf(a) === -1) miniatury.push(a);
        });

        var hlavniVetev = hlavniFoto ? potomekObsahujici(galerie, hlavniFoto) : null;
        var miniaturyKontejner = null;
        var miniaturyVetev = null;
        if (miniatury.length) {
          miniaturyKontejner = miniatury[0].parentElement;
          miniatury.slice(1).forEach(function (m) {
            while (miniaturyKontejner && !miniaturyKontejner.contains(m)) {
              miniaturyKontejner = miniaturyKontejner.parentElement;
            }
          });
          if (miniaturyKontejner && galerie.contains(miniaturyKontejner)) {
            miniaturyVetev = miniaturyKontejner === galerie
              ? potomekObsahujici(galerie, miniatury[0])
              : potomekObsahujici(galerie, miniaturyKontejner);
          }
        }

        // ----- Řádek důvěry pod tlačítkem -----
        // JEDINÁ výjimka z pravidla "JS nevkládá obsah": krátké pevné
        // položky zapsané tady v poli DUVERA. Pouze ověřitelná tvrzení
        // (14 dní na vrácení = zákonné právo spotřebitele; e-shop přijímá
        // online platby).
        var DUVERA = [
          { text: 'Doprava nad 2 000 Kč zdarma',
            ikona: '<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0M5 17H3V6a1 1 0 0 1 1-1h9v12M9 17h6M19 17h2v-6h-8M13 6h5l3 5"/>' },
          { text: '14 dní na vrácení',
            ikona: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/>' },
          { text: 'Bezpečná online platba',
            ikona: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1-8.5 15a12 12 0 0 1-8.5-15A12 12 0 0 0 12 3M11 11a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 12v2.5"/>' }
        ];
        if (!find('.gp-trust')) {
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

        // ----- Odpočet do dopravy zdarma -----
        // Hodnotu košíku čteme z ikony košíku v hlavičce (text "Prázdný
        // košík" nebo částka v Kč). Shoptet ji po přidání zboží přepíše
        // AJAXem — proto MutationObserver. Nenašel-li se košík, pruh se skryje.
        var ZDARMA_OD = 2000; // Kč — doprava zdarma od (potvrzeno majitelkou e-shopu)
        var seznamDuvery = find('.gp-trust');
        if (seznamDuvery && !find('.gp-freeship')) {
          var pruh = document.createElement('div');
          pruh.className = 'gp-freeship';
          pruh.setAttribute('aria-live', 'polite');
          var textPruhu = document.createElement('p');
          textPruhu.className = 'gp-freeship__text';
          var draha = document.createElement('div');
          draha.className = 'gp-freeship__track';
          var vypln = document.createElement('div');
          vypln.className = 'gp-freeship__fill';
          draha.appendChild(vypln);
          pruh.appendChild(textPruhu);
          pruh.appendChild(draha);
          seznamDuvery.parentNode.insertBefore(pruh, seznamDuvery);

          var cenaKosiku = function () {
            var odkaz = find('#header a[href*="/kosik/"]') || find('a[href*="/kosik/"]');
            if (!odkaz) return null;
            var t = (odkaz.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
            if (/prázdn/i.test(t)) return 0;
            var m = t.match(/(\d[\d\s.,]*)\s*Kč/);
            if (!m) return null;
            var cislo = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
            return isNaN(cislo) ? null : cislo;
          };
          var fmt = function (n) { return Math.round(n).toLocaleString('cs-CZ'); };
          var silne = function (txt) {
            var b = document.createElement('strong');
            b.textContent = txt;
            return b;
          };
          var aktualizujDopravu = function () {
            var kosik = cenaKosiku();
            if (kosik === null) { pruh.style.display = 'none'; return; }
            pruh.style.display = '';
            var zbyva = Math.max(0, Math.ceil(ZDARMA_OD - kosik));
            textPruhu.textContent = '';
            pruh.classList.toggle('is-free', zbyva === 0);
            if (zbyva === 0) {
              textPruhu.appendChild(silne('Máš dopravu zdarma'));
            } else if (kosik === 0) {
              textPruhu.appendChild(document.createTextNode('Objednávka nad ' + fmt(ZDARMA_OD) + ' Kč má '));
              textPruhu.appendChild(silne('dopravu zdarma'));
            } else {
              textPruhu.appendChild(document.createTextNode('Do dopravy zdarma ti zbývá '));
              textPruhu.appendChild(silne(fmt(zbyva) + ' Kč'));
            }
            vypln.style.width = Math.min(100, (kosik / ZDARMA_OD) * 100) + '%';
          };
          aktualizujDopravu();

          var casovac = null;
          new MutationObserver(function () {
            clearTimeout(casovac);
            casovac = setTimeout(aktualizujDopravu, 150);
          }).observe(find('#header') || document.body, {
            childList: true, subtree: true, characterData: true
          });
        }

        // ----- Velikosti jako políčka (původní <select> zůstává, jen je skrytý) -----
        // Diagnostika (DevTools): select#simple-variants-select, možnosti typu
        // "Velikost: S - Vyprodáno (1 099 Kč)", value = priceId. Klik na políčko
        // nastaví select a vyvolá 'change' — Shoptet dál počítá cenu, dostupnost
        // i zprávu "Zvolte variantu" přes svůj původní select. Bez selectu
        // (jednoduchý produkt, nebo víc parametrů) se nic nemění.
        var vyber = find('#simple-variants-select');
        if (vyber && !find('.gp-sizes')) {
          var moznosti = findAll('option', vyber).filter(function (o) { return o.value !== ''; });
          if (moznosti.length) {
            var obalVarianty = vyber.closest('.variant-list') || vyber.parentElement;
            var seznamVelikosti = document.createElement('div');
            seznamVelikosti.className = 'gp-sizes';
            seznamVelikosti.setAttribute('role', 'radiogroup');
            var popisekVelikosti = document.createElement('span');
            popisekVelikosti.className = 'gp-sizes-label';
            seznamVelikosti.appendChild(popisekVelikosti);

            var tlacitkaVelikosti = [];
            var nazevParametru = '';
            moznosti.forEach(function (o) {
              var txt = (o.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
              var bezCeny = txt.replace(/\s*\([^)]*\)\s*$/, '');
              var m = bezCeny.match(/^([^:]+):\s*(.*)$/);
              var hodnota = (m ? m[2] : bezCeny).split(/\s+-\s+/)[0].trim() || bezCeny;
              if (m && !nazevParametru) nazevParametru = m[1].trim();
              var vyprodano = /vyprodáno/i.test(txt);

              var b = document.createElement('button');
              b.type = 'button'; // nikdy neodesílat formulář
              b.className = 'gp-size' + (vyprodano ? ' gp-size--out' : '');
              b.textContent = hodnota;
              b.setAttribute('role', 'radio');
              b.setAttribute('aria-label', hodnota + (vyprodano ? ' (vyprodáno)' : ''));
              b.setAttribute('data-value', o.value);
              b.addEventListener('click', function () {
                vyber.value = o.value;
                vyber.dispatchEvent(new Event('change', { bubbles: true }));
                synchronizovat();
              });
              seznamVelikosti.appendChild(b);
              tlacitkaVelikosti.push(b);
            });
            popisekVelikosti.textContent = nazevParametru || 'Velikost';

            function synchronizovat() {
              tlacitkaVelikosti.forEach(function (b) {
                var zapnuto = b.getAttribute('data-value') === String(vyber.value);
                b.classList.toggle('is-on', zapnuto);
                b.setAttribute('aria-checked', zapnuto ? 'true' : 'false');
              });
            }
            vyber.addEventListener('change', synchronizovat);
            synchronizovat();

            obalVarianty.insertBefore(seznamVelikosti, obalVarianty.firstChild);
            [['display', 'block'], ['height', 'auto'], ['min-height', '0'],
             ['max-height', 'none'], ['overflow', 'visible'], ['position', 'relative']]
              .forEach(function (kv) { obalVarianty.style.setProperty(kv[0], kv[1], 'important'); });

            // Nativní popisek "Varianta" (zbyl pod políčky) schováme; zůstane jen "Velikost".
            findAll('.p-detail-inner label, .p-detail-inner span, .p-detail-inner div, .p-detail-inner p, .p-detail-inner strong')
              .forEach(function (el) {
                if (el.children.length === 0 && el.closest && !el.closest('.gp-sizes') &&
                    /^\s*Varianta\s*$/i.test(el.textContent || '')) {
                  el.style.setProperty('display', 'none', 'important');
                }
              });
            vyber.classList.add('gp-select-hidden');
            vyber.setAttribute('aria-hidden', 'true');
            vyber.setAttribute('tabindex', '-1');
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
        var NADPIS = {
          'font-size': '26px', 'font-weight': '500', 'line-height': '1.2',
          'text-transform': 'none', margin: '0 0 8px'
        };
        var SLOUPEC = { float: 'none', width: 'auto', 'max-width': 'none', padding: '0', margin: '0' };

        function aplikuj() {
          uklidit();
          if (window.innerWidth <= 900) return; // mobil: nativní chování šablony

          var sloupce = {
            display: 'grid',
            'grid-template-columns': 'minmax(0, 1fr) minmax(0, 520px)',
            // poslední řádek pohltí přebytečnou výšku vysoké galerie (jinak
            // se rozdělí mezi všechny řádky a pod nadpisem vznikne mezera)
            'grid-template-rows': rezimB ? 'auto' : 'auto auto 1fr',
            'column-gap': '56px',
            'align-items': 'start',
            overflow: 'visible',
            // střed do 1 200 px (a zároveň vynulování záporného okraje .row)
            'max-width': '1200px',
            margin: '0 auto'
          };

          if (rezimB) {
            vynutit(L, sloupce);
            vynutit(gb, Object.assign({ 'grid-column': '1', 'grid-row': '1', position: 'relative' }, SLOUPEC));
            vynutit(pb, Object.assign({ 'grid-column': '2', 'grid-row': '1' }, SLOUPEC));
            vynutit(nadpis, NADPIS);
          } else {
            vynutit(L, Object.assign({ position: 'relative' }, sloupce));
            // Všechny mezilehlé obaly kolem galerie a nadpisu zprůhlednit,
            // aby se galerie a nadpis staly přímými položkami mřížky.
            var obaly = predkoviDo(galerie, L).concat(predkoviDo(nadpis, L));
            obaly.filter(function (o, i) { return obaly.indexOf(o) === i && o !== pb && !pb.contains(o); })
              .forEach(function (o) { vynutit(o, { display: 'contents' }); });
            vynutit(galerie, Object.assign({ 'grid-column': '1', 'grid-row': '1 / span 3' }, SLOUPEC));
            vynutit(nadpis, Object.assign({ 'grid-column': '2', 'grid-row': '1' }, NADPIS));
            vynutit(pb, Object.assign({
              'grid-column': '2', 'grid-row': '2', clear: 'none',
              // panel je sloupec s obtékáním: cena + dostupnost na jednom řádku,
              // ostatní prvky každý na vlastním (řazení řeší CSS přes order)
              display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'wrap',
              'column-gap': '14px', 'align-items': 'baseline'
            }, SLOUPEC));
            if (zalozky) vynutit(zalozky, { 'grid-column': '1 / -1', 'grid-row': '4' });
          }
          try {
            galerieNaSloupec();
          } catch (chyba) {
            window.__gpGal = 'galerie CHYBA: ' + chyba.message;
            log('PDP2 galerie CHYBA: ' + chyba.message);
          }
        }
        function popisEl(el) {
          if (!el) return 'null';
          var r = el.getBoundingClientRect();
          return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().replace(/\s+/g, '.') : '') +
            ' [' + Math.round(r.width) + 'x' + Math.round(r.height) + ']';
        }

        // ================= GALERIE =================
        // Hlavní fotka: rámeček 3:4, fotka ho vyplní (cover).
        // Miniatury: nativní se schovají (zůstanou v DOM a fungují), pod
        // rámečkem se postaví VLASTNÍ řada čtverců. Klik na vlastní miniaturu
        // vyvolá klik na původní → přepínání fotek dělá dál Shoptet.
        var ramFotky = null;
        var mrizMiniatur = null;
        var pozorovateleGalerie = false;

        function stylovatFotku(img, ram) {
          var FOTO = {
            width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none',
            'object-fit': 'cover', 'object-position': 'center', margin: '0', transform: 'none'
          };
          if (ram === img) {
            vynutit(img, {
              width: '100%', 'aspect-ratio': '3 / 4', height: 'auto', display: 'block',
              'max-width': 'none', 'max-height': 'none', 'object-fit': 'cover',
              'object-position': 'center', margin: '0', order: '1'
            });
            return;
          }
          var e = img.parentElement;
          while (e && e !== ram) {
            vynutit(e, {
              position: 'static', display: 'block', width: 'auto', height: 'auto',
              margin: '0', padding: '0', transform: 'none', float: 'none', 'max-width': 'none'
            });
            e = e.parentElement;
          }
          vynutit(img, Object.assign({ position: 'absolute', top: '0', left: '0' }, FOTO));
        }

        function synchronizovatMiniatury() {
          if (!mrizMiniatur) return;
          miniatury.forEach(function (m, i) {
            var zapnuto = m.classList.contains('highlighted') ||
              (m.parentElement && m.parentElement.classList.contains('highlighted'));
            var b = mrizMiniatur.children[i];
            if (b) {
              b.classList.toggle('is-on', !!zapnuto);
              b.setAttribute('aria-pressed', zapnuto ? 'true' : 'false');
            }
          });
        }

        function postavitMriz() {
          mrizMiniatur = document.createElement('div');
          mrizMiniatur.className = 'gp-thumbgrid';
          miniatury.forEach(function (m, i) {
            var zdroj = m.tagName === 'IMG' ? m : find('img', m);
            var adresa = zdroj ? (zdroj.getAttribute('data-src') || zdroj.currentSrc || zdroj.src || '') : '';
            if (!adresa || /^data:/.test(adresa)) adresa = m.getAttribute('href') || adresa;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'gp-thumb';
            b.setAttribute('aria-label', 'Fotka ' + (i + 1));
            var ni = document.createElement('img');
            ni.src = adresa;
            ni.alt = '';
            ni.loading = 'lazy';
            b.appendChild(ni);
            b.addEventListener('click', function () {
              m.click(); // přepnutí fotky dělá původní kód Shoptetu
              setTimeout(synchronizovatMiniatury, 80);
              setTimeout(synchronizovatMiniatury, 400);
            });
            mrizMiniatur.appendChild(b);
          });
          galerie.appendChild(mrizMiniatur);
          synchronizovatMiniatury();
        }

        function obnovitFotku() {
          if (window.innerWidth <= 900 || !ramFotky) return;
          // Když Shoptet při přepnutí fotky vytvoří nový <img>, dostane rámeček a cover.
          findAll('img', ramFotky).forEach(function (im) {
            if (im.style.getPropertyValue('position') === 'absolute') return;
            if (im.closest('.flags')) return;
            if (im.getBoundingClientRect().width < 200) return;
            im.classList.add('gp-pdp-main-img');
            stylovatFotku(im, ramFotky);
          });
        }

        function galerieNaSloupec() {
          if (window.innerWidth <= 900) return;
          if (!hlavniFoto) { window.__gpGal = 'galerie: hlavní fotka NENALEZENA'; return; }
          var ram = potomekObsahujici(galerie, hlavniFoto);
          if (!ram) { window.__gpGal = 'galerie: rámeček nenalezen'; return; }
          ramFotky = ram;
          window.__gpGal = 'galerie: fotek=' + obrazky.length + ' miniatur=' + miniatury.length +
            '\n  hlavni: ' + popisEl(hlavniFoto) +
            '\n  ramecek: ' + popisEl(ram) +
            '\n  kontejner miniatur: ' + popisEl(miniaturyKontejner) +
            '\n  vlastni rada: ' + popisEl(mrizMiniatur) +
            '\n  potomci galerie: ' + Array.prototype.map.call(galerie.children, popisEl).join(' | ');

          vynutit(galerie, {
            display: 'flex', 'flex-direction': 'column', 'align-items': 'stretch',
            gap: '8px', width: '100%', 'max-width': 'none', position: 'relative'
          });

          if (ram !== hlavniFoto) {
            vynutit(ram, {
              order: '1', position: 'relative', display: 'block', width: '100%',
              'max-width': 'none', 'aspect-ratio': '3 / 4', height: 'auto',
              'min-height': '0', overflow: 'hidden', float: 'none', margin: '0', padding: '0'
            });
          }
          stylovatFotku(hlavniFoto, ram);

          if (miniatury.length && miniaturyKontejner) {
            // Nativní miniatury = nejvyšší předek kontejneru, který neobsahuje hlavní fotku.
            var natMin = miniaturyKontejner;
            while (natMin.parentElement && natMin.parentElement !== galerie &&
                   !natMin.parentElement.contains(hlavniFoto)) {
              natMin = natMin.parentElement;
            }
            if (natMin !== ram && !natMin.contains(hlavniFoto) && galerie.contains(natMin)) {
              vynutit(natMin, {
                position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0',
                border: '0', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', opacity: '0',
                'pointer-events': 'none'
              });
            }
            if (!mrizMiniatur) postavitMriz();
          }

          if (!pozorovateleGalerie && window.MutationObserver) {
            pozorovateleGalerie = true;
            if (miniaturyKontejner) {
              new MutationObserver(synchronizovatMiniatury).observe(miniaturyKontejner, {
                attributes: true, attributeFilter: ['class'], subtree: true
              });
            }
            var casObnoveni = null;
            new MutationObserver(function () {
              clearTimeout(casObnoveni);
              casObnoveni = setTimeout(obnovitFotku, 80);
            }).observe(ram, { childList: true, subtree: true });
          }
        }

        // Cena je odsazená zprava (~16 px) proti nadpisu a popisu, příčina není
        // ve stylech na prvku. Změříme, kde skutečně začíná velká cena, a
        // posuneme obal ceny o rozdíl (obě řádky ceny se posunou stejně).
        function vyrovnatCenu() {
          var obalCeny = find('.p-final-price-wrapper', pb);
          if (!obalCeny) return;
          obalCeny.style.removeProperty('margin-left');
          if (window.innerWidth <= 900) return;
          var meritko = find('.price-final-holder', obalCeny) || find('.price-final', obalCeny);
          if (!meritko) return;
          var posun = Math.round(meritko.getBoundingClientRect().left - pb.getBoundingClientRect().left);
          if (posun > 0 && posun < 80) {
            obalCeny.style.setProperty('margin-left', (-posun) + 'px', 'important');
          }
        }

        // Prázdné odstavce (&nbsp;) na konci krátkého popisu dělaly mezeru ~85 px.
        findAll('.p-short-description p, .p-short-description div').forEach(function (el) {
          if (el.children.length === 0 && !(el.textContent || '').replace(/\u00a0/g, ' ').trim()) {
            el.style.setProperty('display', 'none', 'important');
          }
        });

        aplikuj();
        vyrovnatCenu();
        window.addEventListener('resize', function () { aplikuj(); vyrovnatCenu(); });
        window.addEventListener('load', vyrovnatCenu);
      }
    },

    {
      nazev: 'PDP2 — záložky Popis/Diskuze nad popisem, vše v jednom sloupci',
      spustit: function () {
        if (!document.body.classList.contains('gp-pdp2')) return;

        // Blok záložek je sourozenec řádku s galerií uvnitř .p-detail-inner.
        var blok = find('.p-detail-inner .shp-tabs-wrapper') || find('.shp-tabs-wrapper');
        if (!blok) { log('PDP2 záložky: blok .shp-tabs-wrapper nenalezen'); return; }
        blok.classList.add('gp-pdp-tabs');

        // Navigace záložek = seznam odkazující na #description.
        var odkazPopis = find('a[href="#description"]', blok) || find('a[href$="#description"]', blok);
        var nav = odkazPopis ? odkazPopis.closest('ul') : null;
        if (nav) nav.classList.add('gp-tabs-nav');

        // Cíle, jejichž předky "zploštíme" (bez floatů/šířek/sloupců):
        // navigace, obsah popisu, diskuze, tabulka parametrů, ikony Tisk/Zeptat se/Sdílet.
        var cile = [];
        if (nav) cile.push(nav);
        var popis = find('#description', blok);
        if (popis) cile.push(popis);
        var diskuze = find('#productDiscussion', blok);
        if (diskuze) cile.push(diskuze);
        var tabulka = findAll('table', blok).filter(function (t) {
          return /Jméno značky|Kategorie|Záruka/i.test(t.textContent || '');
        })[0];
        if (tabulka) cile.push(tabulka);
        var tisk = find('a[title*="Tisk"]', blok);
        if (tisk) cile.push(tisk);

        cile.forEach(function (cil) {
          var e = cil;
          while (e && e !== blok) {
            if (!e.classList.contains('gp-tabs-nav')) e.classList.add('gp-pdp-flat');
            e = e.parentElement;
          }
        });
        // Vnitřní sloupce popisu (col-md-8 apod.) do hloubky 3 od panelu:
        // bez toho zůstane popis na ~2/3 šířky a zbytek je prázdný.
        [popis, diskuze].forEach(function (panel) {
          if (!panel) return;
          findAll('[class*="col-"], .row', panel).forEach(function (el) {
            var hloubka = 0;
            var n = el.parentElement;
            while (n && n !== panel && hloubka < 6) { hloubka++; n = n.parentElement; }
            if (n === panel && hloubka <= 3) el.classList.add('gp-pdp-flat');
          });
        });
        log('PDP2 záložky: zploštěno ' + findAll('.gp-pdp-flat', blok).length + ' obalů');

        // ----- Nová záložka "Specifikace" (tabulka parametrů + Tisk/Zeptat se/Sdílet) -----
        // Vzor má Specifikaci jako samostatnou záložku. Obsah se pouze PŘESUNE
        // z popisu (nic nevkládáme), nativní odkazy zůstávají funkční.
        if (nav && odkazPopis && popis && tabulka && !find('#gp-specifikace')) {
          var liPopis = odkazPopis.closest('li');
          var paneVychozi = popis.classList.contains('tab-pane') ? popis : popis.closest('.tab-pane');
          if (liPopis && paneVychozi && paneVychozi.parentElement) {
            // Ikony Tisk / Zeptat se / Sdílet = nejbližší společný obal těch odkazů.
            var odkazyIkon = [
              find('a[title*="Tisk"]', blok),
              find('a[href*=":dotaz"]', blok),
              find('a[title*="Sdílet"]', blok)
            ].filter(Boolean);
            var ikony = null;
            if (odkazyIkon.length) {
              ikony = odkazyIkon[0].parentElement;
              odkazyIkon.slice(1).forEach(function (a) {
                while (ikony && !ikony.contains(a)) ikony = ikony.parentElement;
              });
              // pojistka: obal nesmí obsahovat celý popis ani tabulku
              if (ikony && (ikony.contains(tabulka) || (ikony.textContent || '').length > 400)) ikony = null;
            }

            var li = document.createElement('li');
            li.className = (liPopis.className || '').replace(/\bactive\b/g, '').trim();
            li.setAttribute('role', 'presentation');
            var a = document.createElement('a');
            a.href = '#gp-specifikace';
            a.className = (odkazPopis.className || '').replace(/\bactive\b/g, '').trim();
            a.setAttribute('role', 'tab');
            a.textContent = 'Specifikace';
            li.appendChild(a);
            liPopis.parentNode.insertBefore(li, liPopis.nextSibling);

            var pane = document.createElement('div');
            pane.id = 'gp-specifikace';
            pane.className = (paneVychozi.className || '')
              .replace(/\b(active|in|show|fade)\b/g, '').replace(/\s+/g, ' ').trim() + ' gp-pdp-flat gp-spec';
            pane.setAttribute('role', 'tabpanel');
            var tabulkaEl = tabulka.closest('table') || tabulka;
            pane.appendChild(tabulkaEl);
            // Šablona tabulce přebíjí šířku (zůstala zúžená na obsah) → inline !important.
            [['display', 'table'], ['width', '100%'], ['max-width', '720px'],
             ['margin', '0 auto 32px'], ['float', 'none']]
              .forEach(function (kv) { tabulkaEl.style.setProperty(kv[0], kv[1], 'important'); });
            if (ikony) pane.appendChild(ikony);
            paneVychozi.parentNode.insertBefore(pane, paneVychozi.nextSibling);

            var vsechnyLi = function () { return Array.prototype.slice.call(li.parentElement.children); };
            var vsechnyPane = function () { return Array.prototype.slice.call(pane.parentElement.children); };

            a.addEventListener('click', function (e) {
              e.preventDefault();
              vsechnyLi().forEach(function (x) { x.classList.remove('active'); });
              vsechnyPane().forEach(function (x) { x.classList.remove('active'); });
              li.classList.add('active');
              pane.classList.add('active');
            });
            // Kliknutí na nativní záložku (Popis / Diskuze) musí Specifikaci vypnout.
            findAll('a', li.parentElement).forEach(function (jina) {
              if (jina === a) return;
              jina.addEventListener('click', function () {
                setTimeout(function () {
                  li.classList.remove('active');
                  pane.classList.remove('active');
                }, 0);
              });
            });
            log('PDP2 záložky: vytvořena záložka Specifikace' + (ikony ? ' (s ikonami)' : ''));
          }
        }

        // ----- Záložky vedle sebe, na střed (inline !important) -----
        // Šablona (původně svislé záložky vlevo) přebíjí CSS, proto layout
        // řady nastavujeme přímo na prvcích. Vlastní vzhled tlačítek zůstává v CSS.
        if (nav) {
          [['display', 'flex'], ['flex-direction', 'row'], ['flex-wrap', 'wrap'],
           ['justify-content', 'center'], ['align-items', 'flex-end'], ['gap', '0'],
           ['width', '100%'], ['float', 'none'], ['margin', '0 0 32px'],
           ['padding', '0'], ['list-style', 'none']]
            .forEach(function (kv) { nav.style.setProperty(kv[0], kv[1], 'important'); });
          Array.prototype.forEach.call(nav.children, function (polozka) {
            [['float', 'none'], ['display', 'block'], ['width', 'auto'], ['flex', '0 0 auto'],
             ['margin', '0'], ['padding', '0'], ['position', 'relative']]
              .forEach(function (kv) { polozka.style.setProperty(kv[0], kv[1], 'important'); });
          });
        }

        // ----- Vystředění bloku záložek na střed okna (měřením) -----
        // Nadřazené obaly Tanga blok posouvají mimo střed (čára záložek
        // byla o ~78 px vlevo). Změříme střed bloku a posuneme ho relativně.
        function vystredit() {
          blok.style.removeProperty('left');
          if (window.innerWidth <= 900) { blok.style.removeProperty('position'); return; }
          blok.style.setProperty('position', 'relative', 'important');
          var r = blok.getBoundingClientRect();
          var stredBloku = r.left + r.width / 2;
          var stredOkna = document.documentElement.clientWidth / 2;
          blok.style.setProperty('left', Math.round(stredOkna - stredBloku) + 'px', 'important');
        }
        vystredit();
        window.addEventListener('resize', vystredit);
        window.addEventListener('load', vystredit);
      }
    },

    {
      nazev: 'PDP2 — příznaky (Novinka, Tip, sleva) do jednoho sloupce v rohu fotky',
      spustit: function () {
        if (!document.body.classList.contains('gp-pdp2')) return;
        // Diagnostika (DevTools): dva kontejnery — .flags-default (Novinka, Tip)
        // a .flags-extra (štítek slevy) — se oba kladly do stejného rohu
        // a překrývaly se. Obsah extra přesuneme do default, extra schováme.
        var vychozi = find('.p-detail-inner .flags-default');
        var extra = find('.p-detail-inner .flags-extra');
        if (vychozi && extra && vychozi !== extra) {
          while (extra.firstChild) vychozi.appendChild(extra.firstChild);
          extra.style.setProperty('display', 'none', 'important');
        }
      }
    },
    {
      nazev: 'Zápatí (varianta E) — claim, podpis "a vhs.", rozbalovací sekce na mobilu',
      spustit: function () {
        var paticka = find('footer.footer');
        if (!paticka) return;

        // ----- Claim značky (nahoře ve sloupci Kontakt) -----
        var CLAIM = 'Your fitness lovebrand';
        var kontakt = find('.custom-footer__contact', paticka);
        if (kontakt && !find('.gp-footer-claim', kontakt)) {
          var claim = document.createElement('p');
          claim.className = 'gp-footer-claim';
          claim.appendChild(document.createTextNode(CLAIM));
          var tecka = document.createElement('span');
          tecka.textContent = '.';
          claim.appendChild(tecka);
          kontakt.insertBefore(claim, kontakt.firstChild);
        }

        // ----- Kontaktní řádky: vlastní, srovnané (ikona + text), z údajů z administrace -----
        // Nativní řádky (e-mail s ikonou, sociální ikony) měly každý jiné odsazení a při
        // najetí černý kruh. Údaje (e-mail, odkaz na Instagram) čteme z nich, takže se
        // dál mění v administraci. Nativní řádky se jen schovají.
        if (kontakt && !find('.gp-contact', kontakt)) {
          var potomekKontaktu = function (uzel) {
            var n = uzel;
            while (n && n.parentElement !== kontakt) n = n.parentElement;
            return n;
          };
          var emailOdkaz = find('a.project-email', kontakt) || find('a[href^="mailto:"]', kontakt);
          var igOdkaz = find('a[href*="instagram.com"]', kontakt);
          var seznamKontakt = document.createElement('ul');
          seznamKontakt.className = 'gp-contact';
          var SVG_MAIL = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
          var SVG_IG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".7" fill="currentColor"/></svg>';
          function pridatRadek(href, text, svg, novaZalozka) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = href;
            if (novaZalozka) { a.target = '_blank'; a.rel = 'noopener'; }
            a.innerHTML = svg;
            var t = document.createElement('span');
            t.textContent = text;
            a.appendChild(t);
            li.appendChild(a);
            seznamKontakt.appendChild(li);
          }
          if (emailOdkaz) {
            var adresa = (emailOdkaz.getAttribute('href') || '').replace(/^mailto:/i, '').trim() ||
                         (emailOdkaz.textContent || '').trim();
            if (adresa) pridatRadek('mailto:' + adresa, adresa, SVG_MAIL, false);
          }
          if (igOdkaz) {
            var jm = (igOdkaz.getAttribute('href') || '').match(/instagram\.com\/([^\/?#]+)/i);
            pridatRadek(igOdkaz.href, jm ? '@' + jm[1] : 'Instagram', SVG_IG, true);
          }
          if (seznamKontakt.children.length) {
            var claimEl = find('.gp-footer-claim', kontakt);
            kontakt.insertBefore(seznamKontakt, claimEl ? claimEl.nextSibling : kontakt.firstChild);
            [emailOdkaz, igOdkaz].forEach(function (odkazNat) {
              if (!odkazNat) return;
              var vetev = potomekKontaktu(odkazNat);
              if (vetev && vetev !== seznamKontakt && vetev !== claimEl) {
                vetev.style.setProperty('display', 'none', 'important');
              }
            });
          }
        }

        // ----- Podpis: "Vytvořil Shoptet" (nativní) + " a " + logo vhs. -----
        // Logo je bílé, bez oranžového čtverce a bez ™ (v malé velikosti nečitelné),
        // ať drží barvy webu. Odkaz vede na web agentury.
        var titul = find('.footer-bottom a.title', paticka);
        if (titul && !find('.gp-vhs', paticka)) {
          var spojka = document.createElement('span');
          spojka.className = 'gp-vhs-a';
          spojka.textContent = 'a';
          var odkaz = document.createElement('a');
          odkaz.className = 'gp-vhs';
          odkaz.href = 'https://www.v-h-s.cz';
          odkaz.target = '_blank';
          odkaz.rel = 'noopener';
          odkaz.setAttribute('aria-label', 'vhs.');
          var logo = document.createElement('img');
          logo.alt = 'vhs.';
          logo.height = 16;
          logo.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAgCAYAAAC8VE43AAAHZklEQVR42u2aa4xdVRXH/+veOzOVaVpaW2uDLY+U1sYSYyDGVEoMAXwkUlQiwQaV1FSCjQZjiDHKB2MiioTIF0WDqRH8QGMQXwRpiARIAz4qGMEWG7HWOLVMpy2ktffOOT8/sHZY7uxz5s6QmpR0Jzvnnr3X2o+1116P/7nS/6EABvSytrXAF4G3+XtHp8v/CKibvV8B3Acc4ZVym7f3TqV9nfTFmlkFLJB0jaQtki7yrlpSJWnsVFSI3sm8npJGJX1O0mckrQwCw58j/vu04NK1M7Np4CpJ3/DmSpJJSraMU9kEnSyDXLnGPS7p6XRrG+az04J71a7xysP+Kel9kva7gOrXi9M7aSGAmdXAiJlNSLr7tOBmbe4wSS+83sKsnm9sWAHWfg1z79lpu7ZDBrfmMZ8Fx2GSMLNqDh69E+wnmU2ltJdZCc6Zq9dwJRv5g8BsBoH1zGwwgyDMzOphBOaCroYQcHeuAuwBCyW9w0MTK3i8FHPVkp4zswnA0mQe3F4gaTxoXi3piKRnJB2fQaMHHroslXSJpHd7zFdJel7SQ2b2mF/7TpPwQl8FLJa0QdKFks6WtEBSV9JhSfsk/VbSY2Z2KOOdlVp/heHLjnRSKZUCHmih3+w0N/r7IPRN+3MbcDNwoGWcXwLnNuW0qQ1YCNwKTAyxl38BXwPG55QrAxcCx3xT00BVqH2gBj5eENwmX0g/0AI8CLzJaT5dEFwqdfj9Nx8j0Q7C+35gTb7JILRVwLNhrIGvZR+wEXgX8KjvsR/odgEr5yq8W1o2FhfeC7ZEQXjfd5oT/nwKmBfG39Iwfhr7aeAC4AxgvW+2Dv1po88A84COIy6pjgehnXDeNNeNYR3nAMfD2Gm9fwDekMYdGr0ARn3x8Qrlm9sLjOSC84VvCLwvA6u8f2wGjat8E5c4XRr/usJakvC2pLQuHORnM5q47g3ASDpIYHsm2MTzkRKa0xrHmVlf0lZ3BFagwQ32+Q1ecoE/u5K+bWZ/9U1VLV619rH3S9rp16T2he903m4IJdI6PpmBBZK0MYwXx5ek1e6xOz7HncHpTQe6M2adAoYrt6NB69LpfDViZ4Hve94/BSxzLewEuhtanMNTAexMmrwIeDGzgen5MrAs0/w/ZVoWtXkvcFZ2w+7N9vdH4My4hqEzB2f4VoPUE911rvKVu/CEtX3Q+x8wswMeS0X33hYnlfqOSjqU9SctGZe0KkN3pryPwprPc42+AVhiZpWZbXLNvUvSFyS9x8wOh7h0Vg6i43WXn1Suden9Sj+ZMX9eE2je623dTDO3tGjck1HjghbtLGh/+n210yS79aWCjaOghRPuyC5rCJ7nlKsmLbmj4Z6nE93sp5Ii7o95+z4PKplrMu+8aU0HW7RzcQZffVfSPxwY7Rc0L2U3yyR9StLDwG7g88mBvZYkPy1iuwuhkwkg5ZFXAOeY2QBYIelSb/+1mR3z9IkhrmOj/Pw52cK7KPSZZwAbJf3dUWcL0HxyeN3MIayWdLukHcByz6kt18JwE60oON9s18yOS/pOAQYyn3SepE3e9lFJ8/339paNziWZnmzpW5jBVz0z2+XfM25zT90Jhx0F2AtKMZB0saSf+bWPpqJrZphZ7ZUUfpVgpaR1d3te120wuNc63Ye9/3lJj3pb3RB6zLZMtfQtjlphZtMuxBfN7GYzWyHpSknbfJxuQRE64WpfJOkTbqq64SPTmGckbwUWuWMBsE7JxpjZQUn3hNPKBbdW0k2S1jnND8zshGvsbDWuqe9QC8/SV5dsAOuA+4HngCeAq8zs52Z2vQMQt7gGdwrzJe17f+YovyzpWa9/lrQb+CGwrLjHkM6sCTlqXfBWyYMdBd5cyvWCV72+xas+nmxJxrOpxas+Eda6AHihsL4N8VstsBL4TcHTpjEfDrTfbAEHfgeMd0qQt2vdbkm/Kmhd7q1+4VBTtwTNuEDmD4EJ0gCOlkzFauBMn+/tDh0NXHP6TnOrw1U9YNTM9rlH7WdgaZp7r8+93D9nVsE2pjpwqOpDM6EBd8wAsZukbS0xEL65d7Z49DXAGyNS7II8v2G+StIS9+aSNOECSznmqNOsBy53+9cBRp32pQwZTk7jPm87y9OvbrCNFr7SVW6iWgNic6Sj8mtWh+C4chhorJSqhKu3DngpQFR1qOnq3pmBBiPAnjBX5Enm4ycNmOIgQFy/j0k7cKm3TwfYCuDeQLPC+acLJirRb239qJzZmlK5PdJm8Y8B8xvsT6msD/x3DUHf92uVeLb6AeXlEWAzcJNDY3n5UYCqUsbz02D/YgU4mGx6I37vg404FHPEE++DwGGHoc6Ohj1PX4DFTjcJHPIxYp3yMfcAHwh89wSewwWeSeAvwLnxn1DAecDXHbc70SDw2vG+HwOXFw7bgKXAQwXePcDFM0Io2beFt4Soe0zSATPrR5oWzV3i9qJTiO9qSVNm9p9svuXBblnGU0majB943DlVAbVZ63W5AwPHJP3bncBuMzsSTAph3riGy9w+z/OQ5EEzOwp0/guJ+BlqWxmi0gAAAABJRU5ErkJggg==';
          odkaz.appendChild(logo);
          titul.parentNode.insertBefore(spojka, titul.nextSibling);
          titul.parentNode.insertBefore(odkaz, spojka.nextSibling);
        }

        // ----- Sloupce Blog / Informace poznáme podle TEXTU nadpisu -----
        // (třídy __articles / __section2 se ukázaly jako prohozené oproti očekávání)
        findAll('.custom-footer > *', paticka).forEach(function (sloupec) {
          var nadpisSl = find('.pageElement__heading', sloupec);
          var text = nadpisSl ? (nadpisSl.textContent || '') : '';
          if (/blog/i.test(text)) sloupec.classList.add('gp-col-blog');
          else if (/informace/i.test(text)) sloupec.classList.add('gp-col-info');
        });

        // ----- Spodní pruh: levý okraj textu sedí s prvním sloupcem (měřeno) -----
        var spodek = find('.footer-bottom', paticka);
        function zarovnatSpodek() {
          if (!spodek) return;
          spodek.style.removeProperty('padding-left');
          spodek.style.removeProperty('padding-right');
          if (window.innerWidth <= 900 || !kontakt) return;
          var posun = Math.round(kontakt.getBoundingClientRect().left - paticka.getBoundingClientRect().left);
          if (posun > 0 && posun < 300) {
            spodek.style.setProperty('padding-left', posun + 'px', 'important');
            spodek.style.setProperty('padding-right', posun + 'px', 'important');
          }
        }
        zarovnatSpodek();
        window.addEventListener('resize', zarovnatSpodek);
        window.addEventListener('load', zarovnatSpodek);

        // ----- Mobil: Informace a Blog jako rozbalovací sekce (CSS je řídí jen ≤ 900 px) -----
        ['.gp-col-blog', '.gp-col-info', '.custom-footer__section2', '.custom-footer__articles'].forEach(function (sel) {
          var sloupec = find(sel, paticka);
          var nadpis = sloupec ? find('.pageElement__heading', sloupec) : null;
          if (!sloupec || !nadpis || sloupec.classList.contains('gp-acc')) return;
          sloupec.classList.add('gp-acc');
          nadpis.setAttribute('role', 'button');
          nadpis.setAttribute('tabindex', '0');
          nadpis.setAttribute('aria-expanded', 'false');
          function prepnout() {
            var otevreno = sloupec.classList.toggle('is-open');
            nadpis.setAttribute('aria-expanded', otevreno ? 'true' : 'false');
          }
          nadpis.addEventListener('click', prepnout);
          nadpis.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); prepnout(); }
          });
        });

        // Poslední rozbalovací sekce (dole se zavírá linkou) — jen mobilní vzhled.
        var vsechnyAkordeony = findAll('.gp-acc', paticka);
        if (vsechnyAkordeony.length) vsechnyAkordeony[vsechnyAkordeony.length - 1].classList.add('gp-acc-last');
      }
    },
    {
      nazev: 'Mobil — lupa (hledání) vlevo v liště (na počítači zůstává vpravo)',
      spustit: function () {
        var hlavicka = find('#header');
        if (!hlavicka) return;
        // Tlačítko hledání: Shoptet ho značí data-target="search"; nouzově podle textu "Hledat".
        var tlacitko = find('a[data-target="search"]', hlavicka) ||
          findAll('.top-nav-right a', hlavicka).filter(function (a) {
            return /hledat/i.test((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || ''));
          })[0];
        if (!tlacitko) return;
        var polozka = tlacitko.closest('li') || tlacitko;
        if (polozka.parentNode && polozka.parentNode.classList &&
            polozka.parentNode.classList.contains('gp-search-left')) return; // už zpracováno

        var puvodniRodic = polozka.parentNode;
        var puvodniDalsi = polozka.nextSibling;

        var box = document.createElement('div');
        box.className = 'gp-search-left';
        hlavicka.appendChild(box);

        // Idempotentní přepínání podle šířky okna (mobil ≤ 900 px = vlevo).
        function ulozit() {
          if (window.innerWidth <= 900) {
            if (polozka.parentNode !== box) box.appendChild(polozka);
          } else if (polozka.parentNode === box) {
            var kam = (puvodniDalsi && puvodniDalsi.parentNode === puvodniRodic)
              ? puvodniDalsi : puvodniRodic.firstChild;
            puvodniRodic.insertBefore(polozka, kam);
          }
        }
        ulozit();
        window.addEventListener('resize', ulozit);
      }
    },
    {
      nazev: 'Mobil — barva lišty hlavičky přesně jako banner (auto-detekce prvků, které ji přebarvují)',
      spustit: function () {
        var hlavicka = find('#header');
        if (!hlavicka || !document.elementsFromPoint) return;

        function cilovaBarva() {
          var b = '';
          try { b = getComputedStyle(document.documentElement).getPropertyValue('--gp-header-bg'); } catch (e) {}
          return (b && b.trim()) || '#efdde9';
        }
        function mocAlfa(barva) {
          var m = String(barva || '').match(/rgba?\(([^)]+)\)/);
          if (!m) return 0;
          var casti = m[1].split(',').map(function (x) { return parseFloat(x); });
          return casti.length > 3 ? casti[3] : 1;
        }

        // Mobilní lišta byla o pár jednotek jinde než banner (#ecdee8 vs #efdde9).
        // Nevíme, který prvek ji přebarvuje → zeptáme se prohlížeče, co leží na
        // levém okraji lišty, a všem prvkům uvnitř hlavičky s vlastním pozadím
        // nastavíme naši barvu. Vysouvací menu (#navigation) se nemění.
        function srovnat() {
          if (window.innerWidth > 900) return;
          var r = hlavicka.getBoundingClientRect();
          if (r.height <= 0) return;
          var barva = cilovaBarva();
          var vrstvy = document.elementsFromPoint(3, r.top + r.height / 2);
          vrstvy.forEach(function (el) {
            if (el !== hlavicka && !hlavicka.contains(el)) return;
            if (el.closest && el.closest('#navigation')) return;
            var cs = getComputedStyle(el);
            if (mocAlfa(cs.backgroundColor) > 0) {
              el.style.setProperty('background-color', barva, 'important');
            }
            if (cs.backgroundImage && cs.backgroundImage !== 'none') {
              el.style.setProperty('background-image', 'none', 'important');
            }
            ['::before', '::after'].forEach(function (ps) {
              var p = getComputedStyle(el, ps);
              if (p && p.content && p.content !== 'none' && mocAlfa(p.backgroundColor) > 0) {
                el.classList.add('gp-flat-pseudo');
              }
            });
          });
        }

        var casovac = null;
        function odlozit() {
          clearTimeout(casovac);
          casovac = setTimeout(srovnat, 120);
        }
        srovnat();
        window.addEventListener('load', srovnat);
        window.addEventListener('resize', odlozit);
        window.addEventListener('scroll', odlozit, { passive: true });
      }
    },
    {
      nazev: 'Diagnostika hlavičky (jen s ?debug=1, na kterékoli stránce a šířce)',
      spustit: function () {
        if (!/[?&]debug=1(&|$)/.test(location.search)) return;
        var h = find('#header');
        if (!h) return;
        var okno = document.createElement('pre');
        okno.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;max-width:96vw;' +
          'max-height:55vh;overflow:auto;background:#fff;color:#111;border:1px solid #333;' +
          'padding:6px;font:10px/1.3 monospace;white-space:pre-wrap;margin:0';
        document.body.appendChild(okno);
        function popis(el, hloubka) {
          var r = el.getBoundingClientRect();
          var c = getComputedStyle(el);
          var tr = el.getAttribute('class');
          return new Array(hloubka + 1).join('  ') + el.tagName.toLowerCase() +
            (el.id ? '#' + el.id : '') + (tr ? '.' + tr.trim().replace(/\s+/g, '.') : '') +
            ' [' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' +
            Math.round(r.height) + '] disp=' + c.display + ' bg=' + c.backgroundColor;
        }
        function projit(el, hloubka, out) {
          if (out.length > 70 || hloubka > 5) return;
          var r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none') {
            out.push(popis(el, hloubka));
          }
          Array.prototype.forEach.call(el.children, function (ch) { projit(ch, hloubka + 1, out); });
        }
        function obnovit() {
          var out = ['šířka okna: ' + window.innerWidth + '  |  html: ' +
            (document.documentElement.getAttribute('class') || '')];
          projit(h, 0, out);
          okno.textContent = out.join('\n');
        }
        setTimeout(obnovit, 900);
        okno.addEventListener('click', obnovit);
      }
    },
    {
      nazev: 'PDP2 — diagnostické okno (jen s ?debug=1 v adrese)',
      spustit: function () {
        if (!document.body.classList.contains('gp-pdp2')) return;
        if (!/[?&]debug=1(&|$)/.test(location.search)) return;
        var okno = document.createElement('pre');
        okno.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;max-width:560px;max-height:60vh;overflow:auto;background:#fff;color:#111;border:1px solid #333;padding:8px;font:11px/1.35 monospace;white-space:pre-wrap;margin:0';
        document.body.appendChild(okno);
        function popis(sel) {
          var el = find(sel);
          if (!el) return sel + ': NENALEZENO';
          var r = el.getBoundingClientRect();
          var c = getComputedStyle(el);
          return sel + '\n   top=' + Math.round(r.top + window.scrollY) + ' vyska=' + Math.round(r.height) +
            ' sirka=' + Math.round(r.width) + '\n   display=' + c.display + ' position=' + c.position +
            ' margin-top=' + c.marginTop + ' order=' + c.order + ' flex=' + c.flex +
            ' overflow=' + c.overflow;
        }
        function obnovit() {
          okno.textContent = (window.__gpGal ? window.__gpGal + '\n\n' : '') +
            ['.gp-pdp-gallery', '.gp-pdp-main-img', '.gp-thumbgrid', '.gp-thumbgrid > *:first-child',
             '.p-final-price-wrapper', '.gp-pdp-buy', '.p-short-description', '.variant-list',
             '.gp-sizes', '.add-to-cart'].map(popis).join('\n');
        }
        setTimeout(obnovit, 900);
        okno.addEventListener('click', obnovit);
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
