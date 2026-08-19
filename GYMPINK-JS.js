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
        var inner = find('.p-detail-inner');
        if (!inner) return;

        var radek = find('.row', inner);
        var nadpisSloupec = radek ? find('.col-md-4:not(.pull-left)', radek) : null;
        var obrazekSloupec = radek ? find('.detail-img.p-image-wrapper', radek) : null;
        var formSloupec = find('.col-md-4.pull-left', inner);
        if (!radek || !nadpisSloupec || !obrazekSloupec || !formSloupec) return;

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
