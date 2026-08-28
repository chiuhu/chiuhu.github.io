/*
	Photos section
	Data-driven from /assets/data/albums.json.
	Two entry points, chosen by which container exists on the page:
	  - #albums-main  -> overview page (photos/index.html): sidebar nav +
	                     stacked sections, each with a fanned 4-photo stack
	  - #gallery-grid -> single album page (photos/album.html?album=slug)
*/

(function () {
	'use strict';

	var DATA_URL = '/assets/data/albums.json';

	function fetchAlbums() {
		return fetch(DATA_URL).then(function (res) {
			if (!res.ok) throw new Error('Could not load albums.json');
			return res.json();
		}).then(function (data) {
			return data.albums || [];
		});
	}

	function el(tag, attrs, children) {
		var node = document.createElement(tag);
		attrs = attrs || {};
		Object.keys(attrs).forEach(function (key) {
			if (key === 'class') node.className = attrs[key];
			else if (key === 'text') node.textContent = attrs[key];
			else node.setAttribute(key, attrs[key]);
		});
		(children || []).forEach(function (child) {
			node.appendChild(child);
		});
		return node;
	}

	/* ---------- Overview page: sidebar + stacked sections ---------- */

	function renderOverview(albums) {
		var sidebarNav = document.getElementById('sidebar-nav');
		var main = document.getElementById('albums-main');
		if (!sidebarNav || !main) return;

		albums.forEach(function (album) {
			var sidebarLink = el('a', { href: '#' + album.slug, 'data-slug': album.slug, text: album.title });
			sidebarNav.appendChild(sidebarLink);

			var stackLinks = album.cover.slice(0, 4).map(function (src) {
				return el('a', { href: 'album.html?album=' + encodeURIComponent(album.slug) }, [
					el('div', { class: 'polaroid' }, [el('img', { src: src, alt: '' })])
				]);
			});

			var stack = el('div', { class: 'polaroid-stack' }, stackLinks);

			var title = el('a', {
				class: 'album-section-title',
				href: 'album.html?album=' + encodeURIComponent(album.slug)
			}, [el('h2', { text: album.title })]);

			var section = el('div', { class: 'album-section', id: album.slug }, [title, stack]);
			main.appendChild(section);
		});

		setupScrollSpy(sidebarNav, main);
	}

	function setupScrollSpy(sidebarNav, main) {
		var links = Array.prototype.slice.call(sidebarNav.querySelectorAll('a'));
		var sections = Array.prototype.slice.call(main.querySelectorAll('.album-section'));
		if (!sections.length || !('IntersectionObserver' in window)) return;

		var observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				links.forEach(function (link) {
					link.classList.toggle('is-current', link.getAttribute('data-slug') === entry.target.id);
				});
			});
		}, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

		sections.forEach(function (section) { observer.observe(section); });
	}

	/* ---------- Single album page ---------- */

	function renderAlbum(albums) {
		var grid = document.getElementById('gallery-grid');
		if (!grid) return;

		var params = new URLSearchParams(window.location.search);
		var slug = params.get('album');
		var album = albums.filter(function (a) { return a.slug === slug; })[0];

		var titleEl = document.getElementById('album-title');
		var subEl = document.getElementById('album-sub');

		if (!album) {
			if (titleEl) titleEl.textContent = 'Album not found';
			if (subEl) subEl.textContent = '';
			return;
		}

		if (titleEl) titleEl.textContent = album.title;
		if (subEl) subEl.textContent = album.location + ' — ' + album.date;
		document.title = album.title + ' · Hiuhu';

		album.photos.forEach(function (photo) {
			var img = el('img', { src: photo.src, alt: photo.caption || '' });
			var polaroid = el('div', { class: 'polaroid' }, [img]);

			polaroid.addEventListener('click', function () {
				openLightbox(photo.src, photo.caption || '');
			});

			grid.appendChild(polaroid);
		});
	}

	/* ---------- Lightbox ---------- */

	var lightboxEl, lightboxImg, lightboxCaption;

	function ensureLightbox() {
		if (lightboxEl) return;

		lightboxImg = el('img', { src: '', alt: '' });
		lightboxCaption = el('div', { class: 'lightbox-caption' });
		var closeBtn = el('button', { class: 'lightbox-close', 'aria-label': 'Close' });
		closeBtn.textContent = '\u00D7';
		closeBtn.addEventListener('click', closeLightbox);

		lightboxEl = el('div', { class: 'lightbox' }, [closeBtn, lightboxImg, lightboxCaption]);
		lightboxEl.addEventListener('click', function (e) {
			if (e.target === lightboxEl) closeLightbox();
		});

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') closeLightbox();
		});

		document.body.appendChild(lightboxEl);
	}

	function openLightbox(src, caption) {
		ensureLightbox();
		lightboxImg.setAttribute('src', src);
		lightboxCaption.textContent = caption;
		lightboxEl.classList.add('is-open');
	}

	function closeLightbox() {
		if (lightboxEl) lightboxEl.classList.remove('is-open');
	}

	/* ---------- Init ---------- */

	document.addEventListener('DOMContentLoaded', function () {
		fetchAlbums().then(function (albums) {
			renderOverview(albums);
			renderAlbum(albums);
		}).catch(function (err) {
			console.error(err);
		});
	});
})();