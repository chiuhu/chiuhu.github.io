/*
	Photos section
	Data-driven from /assets/data/albums.json.

	Overview page (#albums-main present):
	  Sidebar nav + one section per album, each showing a fanned 4-photo
	  stack. Clicking a stack or its title crossfades that section from
	  the stack into a full gallery grid, in place (accordion-style —
	  opening one collapses any other open section). Clicking a photo in
	  the grid opens the lightbox, which supports prev/next.
*/

(function () {
	'use strict';

	var DATA_URL = '/assets/data/albums.json';
	var TRANSITION_MS = 300;

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

	var SVG_NS = 'http://www.w3.org/2000/svg';

	function svgIcon(pathData) {
		var svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		var path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', pathData);
		svg.appendChild(path);
		return svg;
	}

	function closeIcon() { return svgIcon('M18 6 6 18M6 6l12 12'); }
	function chevronLeft() { return svgIcon('M15 18l-6-6 6-6'); }
	function chevronRight() { return svgIcon('M9 18l6-6-6-6'); }

	function iconButton(className, label, icon) {
		var btn = el('button', { class: 'icon-btn ' + className, 'aria-label': label });
		btn.appendChild(icon);
		return btn;
	}

	function reflow(node) { void node.offsetWidth; }

	/* ---------- Overview page ---------- */

	var openSection = null; // { slug, collapse() }

	function renderOverview(albums) {
		var sidebarNav = document.getElementById('sidebar-nav');
		var main = document.getElementById('albums-main');
		if (!sidebarNav || !main) return;

		albums.forEach(function (album) {
			var sidebarLink = el('a', { href: '#' + album.slug, 'data-slug': album.slug, text: album.title });
			sidebarNav.appendChild(sidebarLink);

			var stackItems = album.cover.slice(0, 4).map(function (src) {
				return el('div', { class: 'stack-item' }, [
					el('div', { class: 'polaroid' }, [el('img', { src: src, alt: '' })])
				]);
			});
			var stack = el('div', { class: 'polaroid-stack' }, stackItems);

			var title = el('button', { class: 'album-section-title' }, [el('h2', { text: album.title })]);

			var grid = el('div', { class: 'gallery-grid is-hidden' });
			var closeBtn = iconButton('grid-close-btn', 'Collapse', closeIcon());
			var closeWrap = el('div', { class: 'grid-close-wrap is-hidden' }, [closeBtn]);

			var section = el('div', { class: 'album-section', id: album.slug }, [title, stack, grid, closeWrap]);
			main.appendChild(section);

			var gridBuilt = false;

			function buildGrid() {
				if (gridBuilt) return;
				gridBuilt = true;
				album.photos.forEach(function (photo, index) {
					var img = el('img', { src: photo.src, alt: photo.caption || '' });
					var polaroid = el('div', { class: 'polaroid' }, [img]);
					polaroid.addEventListener('click', function () {
						openLightbox(album.photos, index, Array.prototype.slice.call(grid.children));
					});
					grid.appendChild(polaroid);
				});
			}

			function expand() {
				if (openSection && openSection.slug !== album.slug) {
					openSection.collapse();
				}
				buildGrid();

				stack.classList.add('is-fading');
				setTimeout(function () {
					stack.classList.add('is-hidden');
					grid.classList.remove('is-hidden');
					reflow(grid);
					grid.classList.add('is-visible');
					closeWrap.classList.remove('is-hidden');
					reflow(closeWrap);
					closeWrap.classList.add('is-visible');
				}, TRANSITION_MS);

				openSection = { slug: album.slug, collapse: collapse };
			}

			function collapse() {
				grid.classList.remove('is-visible');
				closeWrap.classList.remove('is-visible');

				setTimeout(function () {
					grid.classList.add('is-hidden');
					closeWrap.classList.add('is-hidden');
					stack.classList.remove('is-hidden');
					reflow(stack);
					stack.classList.remove('is-fading');
				}, TRANSITION_MS);

				if (openSection && openSection.slug === album.slug) openSection = null;
			}

			stack.addEventListener('click', expand);
			title.addEventListener('click', expand);
			closeBtn.addEventListener('click', collapse);
		});

		setupScrollSpy(sidebarNav, main);
	}

	function setupScrollSpy(sidebarNav, main) {
		var links = Array.prototype.slice.call(sidebarNav.querySelectorAll('a'));

		links.forEach(function (link) {
			link.addEventListener('click', function (e) {
				e.preventDefault();
				var target = document.getElementById(link.getAttribute('data-slug'));
				if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		});
	}

	/* ---------- Standalone album page (album.html?album=slug), still supported ---------- */

	function renderAlbumPage(albums) {
		var grid = document.getElementById('gallery-grid');
		if (!grid || document.getElementById('albums-main')) return;

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

		album.photos.forEach(function (photo, index) {
			var img = el('img', { src: photo.src, alt: photo.caption || '' });
			var polaroid = el('div', { class: 'polaroid' }, [img]);
			polaroid.addEventListener('click', function () {
				openLightbox(album.photos, index, Array.prototype.slice.call(grid.children));
			});
			grid.appendChild(polaroid);
		});
	}

	/* ---------- Lightbox with prev/next ---------- */

	var lightboxEl, lightboxFrame, lightboxImg, lightboxCaption, prevBtn, nextBtn;
	var currentPhotos = [];
	var currentSourceEls = [];
	var currentIndex = 0;
	var CLOSE_MS = 400;

	function ensureLightbox() {
		if (lightboxEl) return;

		lightboxFrame = el('div', { class: 'lightbox-frame' });
		lightboxImg = el('img', { src: '', alt: '' });
		lightboxFrame.appendChild(lightboxImg);

		lightboxCaption = el('div', { class: 'lightbox-caption' });

		prevBtn = iconButton('lightbox-nav lightbox-prev', 'Previous photo', chevronLeft());
		prevBtn.addEventListener('click', function (e) { e.stopPropagation(); showPhoto(currentIndex - 1); });

		nextBtn = iconButton('lightbox-nav lightbox-next', 'Next photo', chevronRight());
		nextBtn.addEventListener('click', function (e) { e.stopPropagation(); showPhoto(currentIndex + 1); });

		lightboxEl = el('div', { class: 'lightbox' }, [prevBtn, nextBtn, lightboxFrame, lightboxCaption]);
		lightboxEl.addEventListener('click', function (e) {
			if (e.target === lightboxEl) closeLightbox();
		});

		document.addEventListener('keydown', function (e) {
			if (!lightboxEl.classList.contains('is-open')) return;
			if (e.key === 'Escape') closeLightbox();
			if (e.key === 'ArrowLeft') showPhoto(currentIndex - 1);
			if (e.key === 'ArrowRight') showPhoto(currentIndex + 1);
		});

		document.body.appendChild(lightboxEl);
	}

	function showPhoto(index) {
		var len = currentPhotos.length;
		currentIndex = ((index % len) + len) % len;
		var photo = currentPhotos[currentIndex];
		lightboxImg.setAttribute('src', photo.src);
		lightboxCaption.textContent = photo.caption || '';
		var multi = len > 1;
		prevBtn.style.display = multi ? '' : 'none';
		nextBtn.style.display = multi ? '' : 'none';
	}

	function flipTransform(sourceEl) {
		var sourceRect = sourceEl.getBoundingClientRect();
		var frameRect = lightboxFrame.getBoundingClientRect();
		var scaleX = sourceRect.width / frameRect.width;
		var scaleY = sourceRect.height / frameRect.height;
		var translateX = (sourceRect.left + sourceRect.width / 2) - (frameRect.left + frameRect.width / 2);
		var translateY = (sourceRect.top + sourceRect.height / 2) - (frameRect.top + frameRect.height / 2);
		return 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scaleX + ', ' + scaleY + ')';
	}

	function openLightbox(photos, index, sourceEls) {
		ensureLightbox();
		currentPhotos = photos;
		currentSourceEls = sourceEls || [];
		showPhoto(index);

		var sourceEl = currentSourceEls[currentIndex];
		if (sourceEl) {
			lightboxFrame.style.transition = 'none';
			lightboxFrame.style.transform = flipTransform(sourceEl);
			reflow(lightboxFrame);
		}

		lightboxEl.classList.add('is-open');

		// Double rAF: guarantees the browser has painted the jumped-to-source
		// state on one frame before we animate away from it on the next —
		// a single rAF can occasionally fire before that paint happens,
		// which is what was causing the jump.
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				lightboxFrame.style.transition = '';
				lightboxFrame.style.transform = '';
			});
		});
	}

	function closeLightbox() {
		if (!lightboxEl || !lightboxEl.classList.contains('is-open')) return;

		var sourceEl = currentSourceEls[currentIndex];
		if (sourceEl && lightboxFrame) {
			lightboxFrame.style.transform = flipTransform(sourceEl);
		}

		lightboxEl.classList.remove('is-open');

		setTimeout(function () {
			if (!lightboxFrame) return;
			lightboxFrame.style.transition = 'none';
			lightboxFrame.style.transform = '';
			reflow(lightboxFrame);
			lightboxFrame.style.transition = '';
		}, CLOSE_MS);
	}

	/* ---------- Init ---------- */

	document.addEventListener('DOMContentLoaded', function () {
		fetchAlbums().then(function (albums) {
			renderOverview(albums);
			renderAlbumPage(albums);
		}).catch(function (err) {
			console.error(err);
		});
	});
})();