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
	function hamburgerIcon() { return svgIcon('M3 6h18M3 12h18M3 18h18'); }

	function iconButton(className, label, icon) {
		var btn = el('button', { class: 'icon-btn ' + className, 'aria-label': label });
		btn.appendChild(icon);
		return btn;
	}

	function reflow(node) { void node.offsetWidth; }

	/* ---------- Overview page ---------- */

	var openSection = null; // { slug, collapse() }
	var gridBackdropEl = null;

	function ensureGridBackdrop() {
		if (gridBackdropEl) return;
		gridBackdropEl = el('div', { class: 'grid-overlay-backdrop' });
		gridBackdropEl.addEventListener('click', function () {
			if (openSection) openSection.collapse();
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && openSection) openSection.collapse();
		});
		document.body.appendChild(gridBackdropEl);
	}

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

			// Hover fan-out: grant a transition only for the duration of
			// the hover interaction, rather than a permanent CSS rule
			// that any resize reflow could inadvertently animate.
			var HOVER_MS = 350;
			var hoverClearTimer = null;
			stack.addEventListener('mouseenter', function () {
				if (hoverClearTimer) { clearTimeout(hoverClearTimer); hoverClearTimer = null; }
				stackItems.forEach(function (item) {
					item.style.transition = 'transform ' + HOVER_MS + 'ms ease';
				});
			});
			stack.addEventListener('mouseleave', function () {
				hoverClearTimer = setTimeout(function () {
					stackItems.forEach(function (item) {
						item.style.transition = '';
					});
					hoverClearTimer = null;
				}, HOVER_MS);
			});

			var title = el('button', { class: 'album-section-title' }, [el('h2', { text: album.title })]);

			var grid = el('div', { class: 'gallery-grid' });
			var closeBtn = iconButton('grid-close-btn', 'Collapse', closeIcon());
			var closeWrap = el('div', { class: 'grid-close-wrap' }, [closeBtn]);
			var panel = el('div', { class: 'grid-overlay-panel is-hidden' }, [grid, closeWrap]);

			var section = el('div', { class: 'album-section', id: album.slug }, [title, stack]);
			main.appendChild(section);
			// Appended directly to body (not nested inside the section/
			// #wrapper) — #wrapper has its own position:relative;z-index:3
			// from the theme's main.css, which traps any z-index set on
			// its descendants within that local context. Since our panel
			// needs its z-index:30 to be compared globally against the
			// backdrop's z-index:29, it has to live outside #wrapper
			// entirely, same as the backdrop and lightbox already do.
			document.body.appendChild(panel);

			var gridBuilt = false;

			// Must match the base (non-hover) rotation values in
			// .polaroid-stack .stack-item:nth-child(n) in photos.css.
			var STACK_ROTATIONS = [-11, -4, 4, 10];
			var FLIP_COUNT = 4; // stack only shows 4 cards, so only the
			                    // first 4 grid photos can fly from real
			                    // stack positions — the rest just fade in.

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

			// Center point of an element, unaffected by its own rotation
			// (rotating around center doesn't move the center point).
			function centerOf(el) {
				var r = el.getBoundingClientRect();
				return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
			}

			function expand() {
				if (openSection && openSection.slug === album.slug) return;
				if (openSection && openSection.slug !== album.slug) {
					openSection.collapse();
				}
				buildGrid();
				ensureGridBackdrop();

				// Claim this as the open section immediately (even though
				// the actual reveal below may still be waiting on images)
				// so a rapid click on a different stack during that wait
				// correctly triggers this one's collapse first, rather
				// than both stacks trying to open at once.
				openSection = { slug: album.slug, collapse: collapse };
				document.body.classList.add('grid-expanded');

				var gridChildren = Array.prototype.slice.call(grid.children);
				var flipCount = Math.min(FLIP_COUNT, gridChildren.length, stack.children.length);

				var flipImgsToLoad = 0;
				for (var i = 0; i < flipCount; i++) {
					var img = gridChildren[i].querySelector('img');
					if (!(img.complete && img.naturalWidth !== 0)) flipImgsToLoad++;
				}

				// Nothing below changes anything visible yet — the stack
				// stays exactly as it is, still fully shown, until we're
				// ready to do the entire reveal (stack fade, panel,
				// backdrop, cards flying in) in one uninterrupted motion.
				// Revealing the panel/grid any earlier than this would
				// show blank white polaroids sitting in their final grid
				// spots while images are still loading — the opposite of
				// what the fly-in animation is supposed to look like.
				function reveal() {
					// Stack positions are measured now, right before it
					// fades — not any earlier, since capturing them sooner
					// wouldn't reflect any last-moment layout changes.
					var stackItems = Array.prototype.slice.call(stack.children);
					var stackCenters = stackItems.map(centerOf);
					stack.classList.add('is-fading');

					panel.classList.remove('is-hidden');
					reflow(panel);
					panel.classList.add('is-open');
					gridBackdropEl.classList.add('is-open');

					for (var i = 0; i < gridChildren.length; i++) {
						var child = gridChildren[i];
						if (i < flipCount) {
							var target = centerOf(child);
							var dx = stackCenters[i].x - target.x;
							var dy = stackCenters[i].y - target.y;
							child.style.transition = 'none';
							child.style.opacity = '';
							child.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + STACK_ROTATIONS[i] + 'deg)';
						} else {
							// No stack card to fly from — just fade in.
							child.style.transition = 'none';
							child.style.transform = '';
							child.style.opacity = '0';
						}
					}
					reflow(grid);

					requestAnimationFrame(function () {
						requestAnimationFrame(function () {
							for (var i = 0; i < gridChildren.length; i++) {
								var child = gridChildren[i];
								if (i < flipCount) {
									child.style.transition = 'transform ' + TRANSITION_MS + 'ms ease';
									child.style.transform = '';
								} else {
									child.style.transition = 'opacity ' + TRANSITION_MS + 'ms ease';
									child.style.opacity = '1';
								}
							}
						});
					});
				}

				if (flipImgsToLoad === 0) {
					reveal();
				} else {
					var loadedCount = 0;
					for (var j = 0; j < flipCount; j++) {
						var flipImg = gridChildren[j].querySelector('img');
						if (flipImg.complete && flipImg.naturalWidth !== 0) continue;
						flipImg.addEventListener('load', function () {
							loadedCount++;
							if (loadedCount === flipImgsToLoad) reveal();
						}, { once: true });
					}
				}
			}

			function collapse() {
				// Stack was never actually removed from layout, so its
				// real position can be measured directly — no need to
				// briefly reveal/re-hide it first.
				var stackItems = Array.prototype.slice.call(stack.children);
				var stackCenters = stackItems.map(centerOf);

				var gridChildren = Array.prototype.slice.call(grid.children);
				var flipCount = Math.min(FLIP_COUNT, gridChildren.length, stackCenters.length);

				for (var i = 0; i < gridChildren.length; i++) {
					var child = gridChildren[i];
					if (i < flipCount) {
						var current = centerOf(child);
						var dx = stackCenters[i].x - current.x;
						var dy = stackCenters[i].y - current.y;
						child.style.transition = 'transform ' + TRANSITION_MS + 'ms ease';
						child.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + STACK_ROTATIONS[i] + 'deg)';
					} else {
						child.style.transition = 'opacity ' + TRANSITION_MS + 'ms ease';
						child.style.opacity = '0';
					}
				}

				gridBackdropEl.classList.remove('is-open');
				panel.classList.remove('is-open');

				setTimeout(function () {
					panel.classList.add('is-hidden');

					for (var i = 0; i < gridChildren.length; i++) {
						gridChildren[i].style.transition = 'none';
						gridChildren[i].style.transform = '';
						gridChildren[i].style.opacity = '';
					}

					stack.classList.remove('is-fading');
					if (!openSection) document.body.classList.remove('grid-expanded');
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
				sidebarNav.classList.remove('is-open');
			});
		});

		setupNavToggle(sidebarNav);
	}

	// Hamburger button, fixed at the bottom of the screen. Only visible
	// within the mobile breakpoint (CSS handles that); toggles the sidebar
	// nav list open/closed as a floating panel above it.
	function setupNavToggle(sidebarNav) {
		var toggle = iconButton('nav-toggle', 'Menu', hamburgerIcon());
		toggle.addEventListener('click', function () {
			sidebarNav.classList.toggle('is-open');
		});
		document.addEventListener('click', function (e) {
			if (!sidebarNav.classList.contains('is-open')) return;
			if (sidebarNav.contains(e.target) || toggle.contains(e.target)) return;
			sidebarNav.classList.remove('is-open');
		});
		document.body.appendChild(toggle);
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

		function runFlipIn() {
			if (sourceEl) {
				lightboxFrame.style.transition = 'none';
				lightboxFrame.style.transform = flipTransform(sourceEl);
				reflow(lightboxFrame);
			}

			lightboxEl.classList.add('is-open');
			document.body.classList.add('lightbox-open');

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

		// The frame has no fixed size of its own — it sizes to fit the
		// image (max-width/max-height only), so its real dimensions
		// aren't known until the image has actually loaded. Measuring
		// it any earlier (as flipTransform does) gives the wrong
		// scale/position, which then visibly snaps once the image
		// arrives. A cached image reports .complete immediately; an
		// uncached one needs its load event first.
		if (lightboxImg.complete && lightboxImg.naturalWidth !== 0) {
			runFlipIn();
		} else {
			lightboxImg.addEventListener('load', runFlipIn, { once: true });
		}
	}

	function closeLightbox() {
		if (!lightboxEl || !lightboxEl.classList.contains('is-open')) return;

		var sourceEl = currentSourceEls[currentIndex];
		if (sourceEl && lightboxFrame) {
			lightboxFrame.style.transform = flipTransform(sourceEl);
		}

		lightboxEl.classList.remove('is-open');
		document.body.classList.remove('lightbox-open');

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