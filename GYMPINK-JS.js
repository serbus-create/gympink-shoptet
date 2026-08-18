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
