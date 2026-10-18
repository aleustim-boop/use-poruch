/* Общий скрипт интернет-магазина для всех тем (без серверной части: корзина и избранное — в localStorage).
 * Конфиг: window.SHOP (макрос shop_config из _shop.html).
 * Точки привязки в разметке темы (все необязательные):
 *   #burger + #nav            — мобильное меню (класс is-open)
 *   .js-catmenu-toggle + .js-catmenu — выпадающее меню каталога (is-open)
 *   form.js-search input      — поиск по товарам (подсказки из /search.json; Enter → /catalog/?q=)
 *   #search-results           — контейнер результатов поиска на /catalog/ (секции с data-hide-on-search скрываются)
 *   .js-buy[data-id…]         — «Купити»: добавить в корзину (атрибуты buy_attrs); .js-fav — «В обране»
 *   [data-cart-count] [data-cart-sum] [data-fav-count] — счётчики в шапке
 *   #cart-root                — страница корзины; #fav-root — страница обраного; #recent [data-recent-row] — недавно просмотренные
 *   .js-order[data-name]      — быстрый заказ (модалка #order-modal, форма #om-form)
 *   [data-qty] .qty__minus/.qty__plus input — счётчик количества
 *   #gal-main + .gallery__thumb[data-src]   — галерея товара
 *   #grid .card[data-price…] + #filters + #sort + [data-view] + #more + [data-shown-count] + #filters-toggle — каталог
 *   [data-tabs] [data-tab=x] [data-panel=x] — вкладки;  [data-slider] > .slide — слайдер баннеров
 */
(function () {
  'use strict';
  var S = window.SHOP || {};
  var P = S.prefix || '';
  var KEY = 'shop:' + (S.key || 'site') + ':';

  // ---------- хранилище ----------
  function load(name, def) { try { var v = localStorage.getItem(KEY + name); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(name, v) { try { localStorage.setItem(KEY + name, JSON.stringify(v)); } catch (e) {} }
  function fmt(n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function plural(n, one, few, many) { n = Math.abs(n) % 100; var d = n % 10; if (n > 10 && n < 20) return many; if (d > 1 && d < 5) return few; if (d === 1) return one; return many; }

  // ---------- корзина ----------
  var cart = load('cart', {});
  var favs = load('favs', {});
  function itemFromEl(el) {
    var d = el.dataset;
    return { id: d.id, name: d.name, price: parseFloat(d.price) || 0, old: parseFloat(d.old) || 0, url: d.url, img: d.img, sku: d.sku || '', unit: d.unit || 'шт.', min: parseInt(d.min, 10) || 1, cat: d.cat || '' };
  }
  function cartList() { return Object.keys(cart).map(function (k) { return cart[k]; }); }
  function cartQty() { return cartList().reduce(function (a, i) { return a + i.qty; }, 0); }
  function cartSum() { return cartList().reduce(function (a, i) { return a + i.qty * i.price; }, 0); }
  // Оптовые пороги сайта: тип sum (грн) / qty (шт.) / lines (позиций)
  function metric(type) { return type === 'sum' ? cartSum() : type === 'lines' ? cartList().length : cartQty(); }
  function unitName(type) { return type === 'sum' ? 'грн' : type === 'lines' ? 'позицій' : 'шт.'; }
  function tierInfo() {
    var tiers = (S.tiers || []).slice().sort(function (a, b) { return a.pct - b.pct; });
    var cur = null, next = null;
    tiers.forEach(function (t) { if (metric(t.type) >= t.min) cur = t; else if (!next) next = t; });
    return { cur: cur, next: next, tiers: tiers };
  }
  function addToCart(item, qty) {
    var ex = cart[item.id];
    if (ex) ex.qty += qty; else { item.qty = qty; cart[item.id] = item; }
    save('cart', cart); refreshCounters(); markButtons();
  }
  function setQty(id, qty) {
    if (!cart[id]) return;
    qty = Math.max(cart[id].min || 1, Math.round(qty) || 0);
    cart[id].qty = qty; save('cart', cart); refreshCounters();
  }
  function removeItem(id) { delete cart[id]; save('cart', cart); refreshCounters(); markButtons(); }
  function clearCart() { cart = {}; save('cart', cart); refreshCounters(); markButtons(); }

  function refreshCounters() {
    var n = cartQty(), sum = cartSum(), f = Object.keys(favs).length;
    qsa('[data-cart-count]').forEach(function (el) { el.textContent = n; el.classList.toggle('is-empty', !n); });
    qsa('[data-cart-sum]').forEach(function (el) { el.textContent = fmt(sum) + ' грн'; });
    qsa('[data-fav-count]').forEach(function (el) { el.textContent = f; el.classList.toggle('is-empty', !f); });
    document.body.classList.toggle('has-cart', n > 0);
  }
  function markButtons() {
    qsa('.js-buy').forEach(function (b) {
      var inCart = !!cart[b.dataset.id];
      b.classList.toggle('is-in-cart', inCart);
      if (b.dataset.labelIn) { var lab = b.querySelector('.btn__label') || b; lab.textContent = inCart ? b.dataset.labelIn : (b.dataset.labelOut || b.dataset.labelDefault || lab.textContent); }
    });
    qsa('.js-fav').forEach(function (b) { b.classList.toggle('is-active', !!favs[b.dataset.id]); b.setAttribute('aria-pressed', favs[b.dataset.id] ? 'true' : 'false'); });
  }
  qsa('.js-buy').forEach(function (b) { if (b.dataset.labelIn && !b.dataset.labelDefault) b.dataset.labelDefault = (b.querySelector('.btn__label') || b).textContent; });

  // ---------- уведомление ----------
  var toastTimer;
  function toast(html) {
    var t = qs('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add('is-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-show'); }, 3500);
  }

  // ---------- клики ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.js-buy');
    if (b) {
      e.preventDefault();
      var item = itemFromEl(b), qty = item.min;
      var box = b.closest('[data-buy-box]') || b.closest('.product__buy') || b.closest('.product');
      var inp = box ? qs('[data-qty] input', box) : null;
      if (inp) qty = Math.max(item.min, parseInt(inp.value, 10) || item.min);
      addToCart(item, qty);
      toast('<strong>' + esc(item.name) + '</strong><br>додано в кошик (' + qty + ' ' + esc(item.unit) + ') · <a href="' + P + S.cart + '">Перейти в кошик</a>');
      return;
    }
    var f = e.target.closest('.js-fav');
    if (f) {
      e.preventDefault();
      var it = itemFromEl(f);
      if (favs[it.id]) { delete favs[it.id]; toast('Прибрано з обраного'); } else { favs[it.id] = it; toast('<strong>' + esc(it.name) + '</strong><br>додано в обране · <a href="' + P + S.favorites + '">Обране</a>'); }
      save('favs', favs); refreshCounters(); markButtons();
      return;
    }
    var o = e.target.closest('.js-order');
    if (o) { e.preventDefault(); openModal(o.dataset.name || '', o.dataset.sku || ''); return; }
    if (e.target.closest('#om-close') || e.target === qs('#order-modal')) closeModal();
    var qm = e.target.closest('.qty__minus'), qp = e.target.closest('.qty__plus');
    if (qm || qp) {
      var wrap = (qm || qp).closest('[data-qty]'), input = qs('input', wrap);
      var min = parseInt(input.min, 10) || 1, step = parseInt(input.step, 10) || 1, v = parseInt(input.value, 10) || min;
      v = qp ? v + step : Math.max(min, v - step);
      input.value = v; input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var th = e.target.closest('.gallery__thumb');
    if (th) {
      var main = qs('#gal-main'); if (main) { main.src = th.dataset.src; qsa('.gallery__thumb').forEach(function (x) { x.classList.remove('is-active'); }); th.classList.add('is-active'); }
    }
    var tab = e.target.closest('[data-tab]');
    if (tab) {
      var tabs = tab.closest('[data-tabs]');
      qsa('[data-tab]', tabs).forEach(function (x) { x.classList.toggle('is-active', x === tab); x.setAttribute('aria-selected', x === tab ? 'true' : 'false'); });
      qsa('[data-panel]', tabs).forEach(function (p) { p.hidden = p.dataset.panel !== tab.dataset.tab; p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab); });
    }
    var ct = e.target.closest('.js-catmenu-toggle');
    if (ct) {
      e.preventDefault();
      var menu = qs('.js-catmenu'); if (!menu) return;
      var open = menu.classList.toggle('is-open'); ct.classList.toggle('is-open', open); ct.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (!e.target.closest('.js-catmenu') && !e.target.closest('.js-catmenu-toggle')) {
      var m = qs('.js-catmenu.is-open'); if (m) { m.classList.remove('is-open'); qsa('.js-catmenu-toggle').forEach(function (x) { x.classList.remove('is-open'); x.setAttribute('aria-expanded', 'false'); }); }
    }
    if (e.target.closest('#filters-toggle')) { var fl = qs('#filters'); if (fl) { fl.classList.toggle('is-open'); document.body.classList.toggle('no-scroll', fl.classList.contains('is-open') && window.innerWidth < 900); } }
    if (e.target.closest('#filters-close') || e.target.closest('#filters-close-apply')) { var fl2 = qs('#filters'); if (fl2) { fl2.classList.remove('is-open'); document.body.classList.remove('no-scroll'); } }
    if (e.target.closest('.js-filters-reset')) { var fr = qs('#filters'); if (fr) { fr.reset(); fr.dispatchEvent(new Event('reset-filters')); } }
    var vb = e.target.closest('[data-view]');
    if (vb) { var g = qs('#grid'); if (g) { g.classList.toggle('grid--list', vb.dataset.view === 'list'); qsa('[data-view]').forEach(function (x) { x.classList.toggle('is-active', x === vb); }); save('view', vb.dataset.view); } }
    if (e.target.closest('.js-cart-clear')) { if (confirm('Очистити кошик?')) { clearCart(); renderCart(); } }
    var rm = e.target.closest('.js-cart-remove');
    if (rm) { removeItem(rm.dataset.id); renderCart(); }
    var cp = e.target.closest('.js-copy-order');
    if (cp) { copyText(orderText()); toast('Текст замовлення скопійовано — вставте його в месенджер'); }
    if (e.target.closest('.js-fav-remove')) { var id = e.target.closest('.js-fav-remove').dataset.id; delete favs[id]; save('favs', favs); refreshCounters(); renderFavs(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); var m = qs('.js-catmenu.is-open'); if (m) m.classList.remove('is-open'); } });
  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (inp.matches('.cart [data-qty] input')) { setQty(inp.closest('[data-qty]').dataset.id, inp.value); renderCart(); }
  });

  // ---------- мобильное меню ----------
  var burger = qs('#burger'), nav = qs('#nav');
  if (burger && nav) burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false'); burger.classList.toggle('is-open', open);
    document.body.classList.toggle('no-scroll', open && window.innerWidth < 900);
  });
  // закрытие мобильного меню по Escape, по клику вне панели и по переходу по ссылке внутри
  function closeNav() {
    if (!nav || !nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open'); document.body.classList.remove('no-scroll');
    if (burger) { burger.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
  }
  if (burger && nav) {
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (e.target.closest('#burger') || e.target.closest('.js-nav-close')) { if (e.target.closest('.js-nav-close')) closeNav(); return; }
      if (!nav.contains(e.target)) closeNav();
      else if (e.target.closest('a[href]') && !e.target.closest('a[href^="#"]')) closeNav();
    });
  }
  window.addEventListener('scroll', function () { document.body.classList.toggle('is-scrolled', window.scrollY > 10); }, { passive: true });

  // ---------- быстрый заказ ----------
  var modal = qs('#order-modal');
  function openModal(name, sku) {
    if (!modal) return;
    var label = name + (sku ? ' (арт. ' + sku + ')' : '');
    var pr = qs('#om-product'); if (pr) pr.textContent = label;
    modal.dataset.product = label;
    var mail = qs('#om-mail');
    if (mail) mail.setAttribute('href', 'mailto:' + S.email + '?subject=' + encodeURIComponent('Замовлення: ' + label) + '&body=' + encodeURIComponent('Доброго дня! Цікавить: ' + label + '\nКількість: \nТелефон для зв\'язку: '));
    var hint = qs('#om-hint'); if (hint) hint.hidden = true;
    modal.hidden = false; document.body.classList.add('no-scroll');
    var ph = qs('#om-form input[name=phone]'); if (ph) setTimeout(function () { ph.focus(); }, 50);
  }
  function closeModal() { if (modal && !modal.hidden) { modal.hidden = true; document.body.classList.remove('no-scroll'); } }
  var omForm = qs('#om-form');
  if (omForm) omForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var phone = omForm.phone.value.trim(), name = omForm.name.value.trim(), prod = modal.dataset.product || '';
    var text = 'Швидке замовлення з сайту ' + S.brand + ' (' + S.domain + ')\nТовар: ' + prod + '\nТелефон: ' + phone + (name ? '\nІм\'я: ' + name : '');
    copyText(text);
    var hint = qs('#om-hint');
    if (hint) { hint.hidden = false; hint.innerHTML = 'Дякуємо! Заявку підготовлено й скопійовано. Надішліть її одним дотиком: <a href="' + esc(S.telegram) + '">Telegram</a> · <a href="' + esc(S.viber) + '">Viber</a> · <a href="mailto:' + esc(S.email) + '?subject=' + encodeURIComponent('Швидке замовлення') + '&body=' + encodeURIComponent(text) + '">E-mail</a> — або просто чекайте дзвінка, якщо вже телефонували.'; }
    location.href = 'mailto:' + S.email + '?subject=' + encodeURIComponent('Швидке замовлення: ' + prod) + '&body=' + encodeURIComponent(text);
  });
  function copyText(t) { try { navigator.clipboard.writeText(t); } catch (e) { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) {} ta.remove(); } }

  // ---------- страница корзины ----------
  function orderText(form) {
    var lines = ['Замовлення з сайту ' + S.brand + ' (' + S.domain + ')', ''];
    cartList().forEach(function (i, n) { lines.push((n + 1) + '. ' + i.name + (i.sku ? ' (арт. ' + i.sku + ')' : '') + ' — ' + i.qty + ' ' + i.unit + ' × ' + fmt(i.price) + ' грн = ' + fmt(i.qty * i.price) + ' грн'); });
    var t = tierInfo(), sum = cartSum(), disc = t.cur ? sum * t.cur.pct / 100 : 0;
    lines.push('', 'Разом: ' + fmt(sum) + ' грн');
    if (t.cur) lines.push('Оптова знижка ' + t.cur.pct_label + ' (' + t.cur.label + '): −' + fmt(disc) + ' грн', 'До сплати: ' + fmt(sum - disc) + ' грн');
    form = form || qs('#cart-form');
    if (form) {
      lines.push('');
      if (form.name.value) lines.push('Ім\'я / компанія: ' + form.name.value);
      if (form.phone.value) lines.push('Телефон: ' + form.phone.value);
      if (form.city.value) lines.push('Місто, відділення Нової пошти: ' + form.city.value);
      if (form.comment.value) lines.push('Коментар: ' + form.comment.value);
    }
    return lines.join('\n');
  }
  function renderCart() {
    var root = qs('#cart-root'); if (!root) return;
    var items = cartList();
    if (!items.length) {
      root.innerHTML = '<div class="cart__empty"><p class="cart__empty-title">У кошику поки порожньо</p><p>Додайте товари з каталогу — оптова знижка порахується автоматично.</p><a class="btn btn--primary" href="' + P + S.catalog + '">Перейти до каталогу</a></div>';
      return;
    }
    var t = tierInfo(), sum = cartSum(), disc = t.cur ? sum * t.cur.pct / 100 : 0;
    var html = '<div class="cart__grid"><div class="cart__list"><table class="cart__table"><thead><tr><th colspan="2">Товар</th><th>Ціна</th><th>Кількість</th><th>Сума</th><th></th></tr></thead><tbody>';
    items.forEach(function (i) {
      html += '<tr class="cart__row"><td class="cart__img"><a href="' + esc(i.url) + '"><img src="' + esc(i.img) + '" alt="' + esc(i.name) + '" loading="lazy"></a></td>' +
        '<td class="cart__name"><a href="' + esc(i.url) + '">' + esc(i.name) + '</a>' + (i.sku ? '<span class="cart__sku">арт. ' + esc(i.sku) + '</span>' : '') + (i.min > 1 ? '<span class="cart__min">мін. ' + i.min + ' ' + esc(i.unit) + '</span>' : '') + '</td>' +
        '<td class="cart__price" data-label="Ціна">' + fmt(i.price) + ' грн' + (i.old ? ' <s>' + fmt(i.old) + '</s>' : '') + '</td>' +
        '<td class="cart__qty" data-label="Кількість"><div class="qty" data-qty data-id="' + esc(i.id) + '"><button type="button" class="qty__minus" aria-label="Менше">−</button><input type="number" min="' + i.min + '" step="1" value="' + i.qty + '"><button type="button" class="qty__plus" aria-label="Більше">+</button></div></td>' +
        '<td class="cart__sum" data-label="Сума"><strong>' + fmt(i.qty * i.price) + ' грн</strong></td>' +
        '<td class="cart__rm"><button type="button" class="js-cart-remove" data-id="' + esc(i.id) + '" aria-label="Прибрати" title="Прибрати">×</button></td></tr>';
    });
    html += '</tbody></table><div class="cart__actions"><a class="link" href="' + P + S.catalog + '">← Продовжити покупки</a><button type="button" class="link js-cart-clear">Очистити кошик</button></div></div>';
    html += '<aside class="cart__side"><div class="cart__summary"><h3>Підсумок</h3>' +
      '<div class="cart__line"><span>' + items.length + ' ' + plural(items.length, 'позиція', 'позиції', 'позицій') + ', ' + cartQty() + ' ' + plural(cartQty(), 'одиниця', 'одиниці', 'одиниць') + '</span><span>' + fmt(sum) + ' грн</span></div>';
    if (t.cur) html += '<div class="cart__line cart__line--disc"><span>Оптова знижка ' + esc(t.cur.pct_label) + '<small>' + esc(t.cur.label) + '</small></span><span>−' + fmt(disc) + ' грн</span></div>';
    html += '<div class="cart__line cart__line--total"><span>До сплати</span><span>' + fmt(sum - disc) + ' грн</span></div>';
    if (t.next) {
      var need = t.next.min - metric(t.next.type);
      html += '<p class="cart__hint">До знижки <strong>' + esc(t.next.pct_label) + '</strong> не вистачає ' + fmt(need) + ' ' + unitName(t.next.type) + ' (' + esc(t.next.label) + ').</p>';
    } else if (t.cur) html += '<p class="cart__hint">Максимальна оптова знижка застосована. Для мереж і великих тиражів — індивідуальні умови.</p>';
    html += '<form class="cart__form" id="cart-form">' +
      '<label><span>Ім\'я або компанія</span><input type="text" name="name" autocomplete="name"></label>' +
      '<label><span>Телефон *</span><input type="tel" name="phone" required placeholder="+380" autocomplete="tel"></label>' +
      '<label><span>Місто, відділення Нової пошти</span><input type="text" name="city" autocomplete="address-level2"></label>' +
      '<label><span>Коментар</span><textarea name="comment" rows="2"></textarea></label>' +
      '<button class="btn btn--primary btn--block" type="submit">Оформити замовлення</button>' +
      '<p class="cart__note">Після натискання відкриється лист із замовленням на ' + esc(S.email) + '. Або надішліть текст замовлення в месенджер:</p>' +
      '<div class="cart__msgs"><button type="button" class="btn btn--outline js-copy-order">Скопіювати замовлення</button><a class="btn btn--outline" href="' + esc(S.telegram) + '">Telegram</a><a class="btn btn--outline" href="' + esc(S.viber) + '">Viber</a><a class="btn btn--outline" href="tel:' + esc(S.phoneRaw) + '">' + esc(S.phone) + '</a></div>' +
      '</form><p class="cart__seller">' + esc(S.fop) + ' · ' + esc(S.city) + '. Рахунок для ФОП і ТОВ, оплата на рахунок, карткою або накладеним платежем.</p></div></aside></div>';
    root.innerHTML = html;
    var form = qs('#cart-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = orderText(form);
      copyText(text);
      location.href = 'mailto:' + S.email + '?subject=' + encodeURIComponent('Замовлення з сайту ' + S.brand) + '&body=' + encodeURIComponent(text);
      toast('Замовлення сформовано й скопійовано. Якщо поштовий клієнт не відкрився — надішліть текст у Telegram або Viber.');
    });
  }
  renderCart();

  // ---------- страница обраного ----------
  function miniCard(i, extra) {
    return '<article class="mcard"><a class="mcard__img" href="' + esc(i.url) + '"><img src="' + esc(i.img) + '" alt="' + esc(i.name) + '" loading="lazy"></a>' +
      '<div class="mcard__body"><a class="mcard__name" href="' + esc(i.url) + '">' + esc(i.name) + '</a><div class="mcard__price">' + fmt(i.price) + ' грн' + (i.old ? ' <s>' + fmt(i.old) + '</s>' : '') + '</div>' +
      '<div class="mcard__foot"><button type="button" class="btn btn--sm js-buy" data-id="' + esc(i.id) + '" data-name="' + esc(i.name) + '" data-price="' + i.price + '" data-old="' + (i.old || '') + '" data-url="' + esc(i.url) + '" data-img="' + esc(i.img) + '" data-sku="' + esc(i.sku) + '" data-unit="' + esc(i.unit) + '" data-min="' + i.min + '" data-cat="' + esc(i.cat) + '">Купити</button>' + (extra || '') + '</div></div></article>';
  }
  function renderFavs() {
    var root = qs('#fav-root'); if (!root) return;
    var items = Object.keys(favs).map(function (k) { return favs[k]; });
    if (!items.length) { root.innerHTML = '<div class="favs__empty"><p class="favs__empty-title">В обраному поки нічого немає</p><p>Натискайте «сердечко» на товарах, щоб повернутися до них пізніше.</p><a class="btn btn--primary" href="' + P + S.catalog + '">До каталогу</a></div>'; return; }
    root.innerHTML = '<div class="favs__grid">' + items.map(function (i) { return miniCard(i, '<button type="button" class="link js-fav-remove" data-id="' + esc(i.id) + '">Прибрати</button>'); }).join('') + '</div>';
    markButtons();
  }
  renderFavs();

  // ---------- недавно просмотренные ----------
  var recent = load('recent', []);
  var pb = qs('.product .js-buy, [data-product-main] .js-buy');
  if (pb && document.body.classList.contains('page-product')) {
    var cur = itemFromEl(pb);
    recent = [cur].concat(recent.filter(function (r) { return r.id !== cur.id; })).slice(0, 12);
    save('recent', recent);
  }
  var rr = qs('#recent');
  if (rr) {
    var curId = pb ? pb.dataset.id : null;
    var show = recent.filter(function (r) { return r.id !== curId; }).slice(0, 6);
    if (show.length) { rr.hidden = false; qs('[data-recent-row]', rr).innerHTML = show.map(function (i) { return miniCard(i); }).join(''); }
  }

  // ---------- поиск ----------
  var index = null, indexLoading = null;
  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!indexLoading) indexLoading = fetch(P + '/search.json').then(function (r) { return r.json(); }).then(function (d) { index = d; return d; }).catch(function () { index = []; return index; });
    return indexLoading;
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-яіїєґ0-9]+/g, ' ').trim(); }
  function search(q, limit) {
    q = norm(q); if (!q) return [];
    var words = q.split(' ');
    var res = [];
    index.forEach(function (p) {
      var hay = norm(p.n + ' ' + p.c + ' ' + p.b + ' ' + p.s);
      var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
      if (ok) res.push(p);
    });
    return limit ? res.slice(0, limit) : res;
  }
  qsa('form.js-search').forEach(function (form) {
    var input = qs('input[type=search], input[type=text]', form); if (!input) return;
    var drop = document.createElement('div'); drop.className = 'search__drop'; drop.hidden = true; form.appendChild(drop);
    form.classList.add('has-drop');
    function render() {
      var q = input.value.trim();
      if (q.length < 2) { drop.hidden = true; return; }
      loadIndex().then(function () {
        var res = search(q, 8);
        if (!res.length) { drop.innerHTML = '<div class="search__empty">Нічого не знайдено за «' + esc(q) + '»</div>'; drop.hidden = false; return; }
        drop.innerHTML = res.map(function (p) { return '<a class="search__item" href="' + P + esc(p.u) + '"><img src="' + P + esc(p.i) + '" alt=""><span class="search__name">' + esc(p.n) + '<small>' + esc(p.c) + '</small></span><span class="search__price">' + esc(p.p) + ' грн</span></a>'; }).join('') +
          '<a class="search__all" href="' + P + S.catalog + '?q=' + encodeURIComponent(q) + '">Усі результати →</a>';
        drop.hidden = false;
      });
    }
    input.addEventListener('input', render);
    input.addEventListener('focus', function () { loadIndex(); if (input.value.trim().length >= 2) render(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); var q = input.value.trim(); if (q) location.href = P + S.catalog + '?q=' + encodeURIComponent(q); });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) drop.hidden = true; });
  });
  // результаты поиска на странице каталога (?q=)
  var sr = qs('#search-results');
  if (sr) {
    var m = location.search.match(/[?&]q=([^&]*)/);
    if (m) {
      var q = decodeURIComponent(m[1].replace(/\+/g, ' '));
      qsa('[data-hide-on-search]').forEach(function (el) { el.hidden = true; });
      sr.hidden = false;
      qsa('form.js-search input').forEach(function (i) { i.value = q; });
      loadIndex().then(function () {
        var res = search(q);
        var title = qs('[data-search-title]', sr); if (title) title.textContent = res.length ? 'Знайдено ' + res.length + ' ' + plural(res.length, 'товар', 'товари', 'товарів') + ' за запитом «' + q + '»' : 'За запитом «' + q + '» нічого не знайдено';
        var row = qs('[data-search-row]', sr);
        if (row) row.innerHTML = res.map(function (p) { return '<article class="mcard"><a class="mcard__img" href="' + P + esc(p.u) + '"><img src="' + P + esc(p.i) + '" alt="' + esc(p.n) + '" loading="lazy"></a><div class="mcard__body"><span class="mcard__cat">' + esc(p.c) + '</span><a class="mcard__name" href="' + P + esc(p.u) + '">' + esc(p.n) + '</a><div class="mcard__price">' + esc(p.p) + ' грн</div><div class="mcard__foot"><a class="btn btn--sm" href="' + P + esc(p.u) + '">Детальніше</a></div></div></article>'; }).join('') || '<p>Спробуйте інше слово або перегляньте <a href="' + P + S.catalog + '">увесь каталог</a>.</p>';
        document.title = 'Пошук: ' + q + ' — ' + S.brand;
      });
    }
  }

  // ---------- каталог: фильтры, сортировка, «показати ще» ----------
  var grid = qs('#grid');
  if (grid) {
    var cards = qsa('.card', grid);
    cards.forEach(function (c, i) { c.dataset.i = i; });
    var filters = qs('#filters'), sort = qs('#sort'), more = qs('#more');
    var step = parseInt((more && more.dataset.step) || grid.dataset.step || '24', 10), shown = step;
    var savedView = load('view', null);
    // восстанавливаем сохранённый вид: тема может задавать grid--list по умолчанию, поэтому «плитка» снимает класс
    if ((savedView === 'list' || savedView === 'grid') && qs('[data-view="' + savedView + '"]')) { grid.classList.toggle('grid--list', savedView === 'list'); qsa('[data-view]').forEach(function (x) { x.classList.toggle('is-active', x.dataset.view === savedView); }); }
    function apply() {
      var pmin = filters && filters.pmin ? parseFloat(filters.pmin.value) : NaN, pmax = filters && filters.pmax ? parseFloat(filters.pmax.value) : NaN;
      var brands = filters ? qsa('input[name=brand]:checked', filters).map(function (x) { return x.value; }) : [];
      var subs = filters ? qsa('input[name=sub]:checked', filters).map(function (x) { return x.value; }) : [];
      var instock = filters && filters.instock ? filters.instock.checked : false;
      var sale = filters && filters.sale ? filters.sale.checked : false;
      var vis = cards.filter(function (c) {
        var p = parseFloat(c.dataset.price) || 0;
        if (!isNaN(pmin) && p < pmin) return false;
        if (!isNaN(pmax) && pmax > 0 && p > pmax) return false;
        if (brands.length && brands.indexOf(c.dataset.brand) < 0) return false;
        if (subs.length && subs.indexOf(c.dataset.sub) < 0) return false;
        if (instock && c.dataset.avail !== '1') return false;
        if (sale && c.dataset.sale !== '1') return false;
        return true;
      });
      var v = sort ? sort.value : 'default';
      vis.sort(function (a, b) {
        if (v === 'price-asc') return a.dataset.price - b.dataset.price;
        if (v === 'price-desc') return b.dataset.price - a.dataset.price;
        if (v === 'name') return a.dataset.name < b.dataset.name ? -1 : 1;
        if (v === 'sale') return (b.dataset.sale - a.dataset.sale) || (a.dataset.i - b.dataset.i);
        if (v === 'new') return (b.dataset.new - a.dataset.new) || (a.dataset.i - b.dataset.i);
        return a.dataset.i - b.dataset.i;
      });
      cards.forEach(function (c) { c.hidden = true; });
      vis.forEach(function (c, i) { grid.appendChild(c); c.hidden = i >= shown; });
      qsa('[data-shown-count]').forEach(function (el) { el.textContent = Math.min(shown, vis.length); });
      qsa('[data-total-count]').forEach(function (el) { el.textContent = vis.length; });
      if (more) more.hidden = vis.length <= shown;
      var empty = qs('#grid-empty'); if (empty) empty.hidden = vis.length > 0;
      // счётчики активных фильтров
      var active = brands.length + subs.length + (instock ? 1 : 0) + (sale ? 1 : 0) + ((!isNaN(pmin) && filters && pmin > parseFloat(filters.pmin.min || '0')) || (!isNaN(pmax) && filters && pmax < parseFloat(filters.pmax.max || 'Infinity')) ? 1 : 0); // ценовой фильтр активен только при отклонении от границ категории
      qsa('[data-filters-count]').forEach(function (el) { el.textContent = active ? active : ''; el.hidden = !active; });
    }
    if (filters) {
      filters.addEventListener('change', function () { shown = step; apply(); });
      filters.addEventListener('submit', function (e) { e.preventDefault(); shown = step; apply(); });
      // ползунки диапазона цены (name=pmin_r / pmax_r) синхронизируются с полями
      ['pmin', 'pmax'].forEach(function (n) {
        var r = filters[n + '_r'], f = filters[n];
        if (r && f) { r.addEventListener('input', function () { f.value = r.value; }); f.addEventListener('input', function () { r.value = f.value; }); }
      });
      filters.addEventListener('reset-filters', function () { ['pmin', 'pmax'].forEach(function (n) { var r = filters[n + '_r'], f = filters[n]; if (r && f) r.value = f.value; }); shown = step; apply(); });
    }
    if (sort) sort.addEventListener('change', function () { shown = step; apply(); });
    if (more) more.addEventListener('click', function () { shown += step; apply(); });
    apply();
  }

  // ---------- слайдер баннеров ----------
  qsa('[data-slider]').forEach(function (sl) {
    var slides = qsa('.slide', sl); if (slides.length < 2) return;
    var i = 0, timer, interval = parseInt(sl.dataset.interval || '6000', 10);
    var dots = document.createElement('div'); dots.className = 'slider__dots';
    slides.forEach(function (_, k) { var d = document.createElement('button'); d.type = 'button'; d.setAttribute('aria-label', 'Слайд ' + (k + 1)); d.addEventListener('click', function () { go(k); restart(); }); dots.appendChild(d); });
    sl.appendChild(dots);
    var prev = document.createElement('button'), next = document.createElement('button');
    prev.type = next.type = 'button'; prev.className = 'slider__arrow slider__arrow--prev'; next.className = 'slider__arrow slider__arrow--next';
    prev.innerHTML = '&#10094;'; next.innerHTML = '&#10095;'; prev.setAttribute('aria-label', 'Попередній'); next.setAttribute('aria-label', 'Наступний');
    prev.addEventListener('click', function () { go(i - 1); restart(); }); next.addEventListener('click', function () { go(i + 1); restart(); });
    sl.appendChild(prev); sl.appendChild(next);
    function go(k) {
      i = (k + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === i); s.setAttribute('aria-hidden', n === i ? 'false' : 'true'); });
      qsa('button', dots).forEach(function (d, n) { d.classList.toggle('is-active', n === i); });
    }
    function restart() { clearInterval(timer); timer = setInterval(function () { go(i + 1); }, interval); }
    var x0 = null;
    sl.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    sl.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { go(dx < 0 ? i + 1 : i - 1); restart(); } x0 = null; });
    sl.addEventListener('mouseenter', function () { clearInterval(timer); }); sl.addEventListener('mouseleave', restart);
    go(0); restart();
  });

  // ---------- вкладки: первая активна по умолчанию ----------
  qsa('[data-tabs]').forEach(function (t) {
    var act = qs('[data-tab].is-active', t) || qs('[data-tab]', t); if (!act) return;
    qsa('[data-panel]', t).forEach(function (p) { p.hidden = p.dataset.panel !== act.dataset.tab; p.classList.toggle('is-active', p.dataset.panel === act.dataset.tab); });
    act.classList.add('is-active');
  });

  refreshCounters(); markButtons();
  window.Shop = { cart: cartList, add: addToCart, favs: favs, tier: tierInfo, toast: toast };
})();
