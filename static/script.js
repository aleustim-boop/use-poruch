// Тема 04 «Усе Поруч»: бургер-меню, модалка заказа, галерея, сортировка, лента категорий, липкая шапка
(function () {
  // Бургер-меню
  var burger = document.getElementById('burger'), nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('is-open'); burger.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); }
    });
    // Прямая ссылка на меню (#nav) открывает его на мобильном
    if (location.hash === '#nav' && getComputedStyle(burger).display !== 'none') burger.click();
  }

  // Шапка: после прокрутки прячем верхнюю строку
  var top = document.getElementById('top');
  function onScroll() { if (top) top.classList.toggle('is-scrolled', window.scrollY > 60); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Модальное окно заказа
  var modal = document.getElementById('order-modal'), omProduct = document.getElementById('om-product'), omMail = document.getElementById('om-mail');
  function openModal(name, sku) {
    if (!modal) return;
    var label = (name || 'Замовлення') + (sku ? ' (арт. ' + sku + ')' : '');
    if (omProduct) omProduct.textContent = label;
    if (omMail) {
      var base = omMail.getAttribute('href').split('?')[0];
      omMail.setAttribute('href', base + '?subject=' + encodeURIComponent('Замовлення: ' + label) + '&body=' + encodeURIComponent('Доброго дня! Цікавить: ' + label + '\nКількість: \nТелефон для зв\'язку: '));
    }
    modal.hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeModal() { if (modal && !modal.hidden) { modal.hidden = true; document.body.classList.remove('no-scroll'); } }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.js-order');
    if (b) { e.preventDefault(); openModal(b.dataset.name, b.dataset.sku); return; }
    if (e.target === modal || e.target.id === 'om-close') closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // Галерея товара
  var main = document.getElementById('gal-main');
  if (main) {
    document.querySelectorAll('.gal__thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        main.src = t.dataset.src;
        document.querySelectorAll('.gal__thumb').forEach(function (x) { x.classList.remove('is-active'); });
        t.classList.add('is-active');
      });
    });
  }

  // Сортировка по цене в категории
  var sort = document.getElementById('sort'), grid = document.getElementById('grid');
  if (sort && grid) {
    var cards = Array.prototype.slice.call(grid.children);
    cards.forEach(function (c, i) {
      var pr = c.querySelector('.price');
      c.dataset.i = i;
      c.dataset.p = parseFloat(((pr && pr.textContent) || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    });
    sort.addEventListener('change', function () {
      var v = sort.value;
      cards.sort(function (a, b) {
        if (v === 'price-asc') return a.dataset.p - b.dataset.p;
        if (v === 'price-desc') return b.dataset.p - a.dataset.p;
        return a.dataset.i - b.dataset.i;
      });
      cards.forEach(function (c) { grid.appendChild(c); });
    });
  }

  // Горизонтальная лента категорий: кнопки «назад/вперёд»
  var scroller = document.getElementById('cat-scroller');
  if (scroller) {
    document.querySelectorAll('.scroller__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = parseInt(b.dataset.scroll, 10) || 1;
        scroller.scrollBy({ left: dir * Math.max(240, scroller.clientWidth * 0.7), behavior: 'smooth' });
      });
    });
  }
})();
