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
          obsah.style.setProperty('padding-top', (vyska + 16) + 'px', 'important');
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
      nazev: 'POBO popis — mobilní úklid inline rozměrů',
      spustit: function () {
        // POBO Page Builder sází bloky s pevnými desktopovými rozměry
        // přímo do atributu style. Pokud je zapíše s !important,
        // NELZE je přebít žádným externím CSS — jediná cesta je je
        // z inline stylu odstranit, což dělá tenhle krok.
        // Jen mobil; na desktopu má POBO layout zůstat tak, jak si ho
        // klientka v editoru nastavila.
        if (window.innerWidth > 900) return;

        var zalozky = find('.p-detail-tabs-wrapper');
        if (!zalozky) return;

        // Vlastnosti, které na úzké obrazovce rozbíjejí layout.
        var problemove = [
          'width', 'min-width', 'height', 'min-height',
          'position', 'left', 'right', 'top', 'bottom',
          'transform', 'float', 'white-space'
        ];

        var prvky = zalozky.querySelectorAll('[style]');
        Array.prototype.forEach.call(prvky, function (el) {
          problemove.forEach(function (vlastnost) {
            el.style.removeProperty(vlastnost);
          });
        });

        // Po odstranění inline rozměrů ještě pojistit obrázky, ať se
        // vejdou do šířky (některé mají rozměry v atributech).
        var obrazky = zalozky.querySelectorAll('img');
        Array.prototype.forEach.call(obrazky, function (img) {
          img.style.setProperty('max-width', '100%', 'important');
          img.style.setProperty('height', 'auto', 'important');
        });
      }
    },

  ];


  /* -----------------------------------------------------------------
     SPUŠTĚNÍ
     ----------------------------------------------------------------- */

  function spustit() {
    log('Start, úprav k provedení: ' + upravy.length);

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
