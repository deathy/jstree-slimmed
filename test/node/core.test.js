'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JQUERY, BUILDS, createEnv, createTree, nextEvent, key, mouse, wait, sample, same } = require('./helpers');
const pkg = require('../../package.json');

const KEY = { enter: 13, space: 32, end: 35, home: 36, left: 37, up: 38, right: 39, down: 40, star: 106 };

for (const jq of JQUERY) {
	for (const build of BUILDS) {
		describe('core - ' + jq.name + ' - ' + build, function () {
			let env, $;
			beforeEach(function () {
				env = createEnv(jq, build, { body: '<div id="tree"></div><div id="other"></div>' });
				$ = env.$;
			});
			afterEach(function () {
				assert.deepStrictEqual(env.errors, [], 'no uncaught errors');
				env.window.close();
			});

			function anchor(id) { return env.document.getElementById(id + '_anchor'); }
			function focused() { return env.document.activeElement && env.document.activeElement.id.replace(/_anchor$/, ''); }

			it('loads on the expected jQuery and reports the package version', function () {
				assert.equal(Number($.fn.jquery.split('.')[0]), jq.major);
				assert.equal(typeof $.fn.jstree, 'function');
				assert.equal($.jstree.version, pkg.version);
				same(Object.keys($.jstree.plugins).sort(), ['changed', 'checkbox', 'massload']);
			});

			it('builds a tree from HTML markup', async function () {
				$('#tree').html(
					'<ul>' +
						'<li id="h1" data-jstree=\'{"opened":true}\'>One<ul><li id="h11">One.One</li></ul></li>' +
						'<li id="h2" data-jstree=\'{"disabled":true,"icon":"custom-icon"}\'><a href="#x">Two</a></li>' +
					'</ul>'
				);
				const t = await createTree(env, '#tree');
				same(t.get_node('#').children, ['h1', 'h2']);
				assert.equal(t.get_text('h11'), 'One.One');
				assert.equal(t.get_parent('h11'), 'h1');
				assert.equal(t.is_open('h1'), true);
				assert.equal(t.is_disabled('h2'), true);
				assert.equal(t.get_icon('h2'), 'custom-icon');
				assert.equal(t.get_node('h2').a_attr.href, '#x');
			});

			it('builds a tree from JSON with the expected DOM and ARIA attributes', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() } });
				assert.equal($('#tree').attr('role'), 'tree');
				assert.equal($('#tree').hasClass('jstree'), true);
				assert.equal($('#tree .jstree-anchor').length, 5, 'only opened branches are rendered');
				assert.equal($('#a1').attr('role'), 'none');
				assert.equal($(anchor('a1')).attr('role'), 'treeitem');
				assert.equal($(anchor('a')).attr('aria-level'), '1');
				assert.equal($(anchor('a2')).attr('aria-level'), '2');
				assert.equal($(anchor('a')).attr('aria-expanded'), 'true');
				assert.equal($(anchor('a2')).attr('aria-expanded'), 'false');
				assert.equal($(anchor('c')).attr('aria-expanded'), undefined, 'leaves have no aria-expanded');
				assert.equal($('#a').hasClass('jstree-open'), true);
				assert.equal($('#a2').hasClass('jstree-closed'), true);
				assert.equal($('#c').hasClass('jstree-leaf'), true);
				assert.equal($('#c').hasClass('jstree-last'), true);
				assert.equal($(anchor('a1')).children('.jstree-icon').hasClass('jstree-file'), true);
				assert.equal(t.get_container()[0], $('#tree')[0]);
				assert.equal($('#tree').jstree(true), t, 'instance lookup via the plugin');
				assert.equal($.jstree.reference('a1'), t, 'instance lookup via a node id');
			});

			it('supports the :jstree pseudo selector', async function () {
				await createTree(env, '#tree', { core: { data: sample() } });
				same($('div:jstree').toArray().map(function (e) { return e.id; }), ['tree']);
			});

			it('opens, closes and toggles nodes and fires events', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample(), animation: false } });
				const opened = nextEvent(env, '#tree', 'open_node.jstree');
				t.open_node('a2');
				assert.equal((await opened).node.id, 'a2');
				assert.equal(t.is_open('a2'), true);
				assert.equal($(anchor('a2')).attr('aria-expanded'), 'true');
				assert.ok(anchor('a21'), 'children rendered once opened');

				const closed = nextEvent(env, '#tree', 'close_node.jstree');
				t.close_node('a2');
				assert.equal((await closed).node.id, 'a2');
				assert.equal(t.is_closed('a2'), true);
				assert.equal($(anchor('a2')).attr('aria-expanded'), 'false');

				t.toggle_node('a2');
				assert.equal(t.is_open('a2'), true);
				t.toggle_node('a2');
				assert.equal(t.is_open('a2'), false);

				t.open_all();
				same(['a', 'a2', 'b'].map(t.is_open.bind(t)), [true, true, true]);
				t.close_all();
				same(['a', 'a2', 'b'].map(t.is_open.bind(t)), [false, false, false]);
			});

			it('selects and deselects nodes and reports changes', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['changed'] });
				let changed = nextEvent(env, '#tree', 'changed.jstree');
				t.select_node('a1');
				let data = await changed;
				same(data.selected, ['a1']);
				same(data.changed.selected, ['a1']);
				same(data.changed.deselected, []);
				assert.equal($(anchor('a1')).hasClass('jstree-clicked'), true);
				assert.equal($(anchor('a1')).attr('aria-selected'), 'true');

				t.select_node(['c', 'b1']);
				same(t.get_selected().sort(), ['a1', 'b1', 'c']);
				same(t.get_top_selected().sort(), ['a1', 'b1', 'c']);
				assert.equal(t.get_selected(true)[0].text, 'Apple');
				assert.equal(t.is_selected('b1'), true);

				changed = nextEvent(env, '#tree', 'changed.jstree');
				t.deselect_node('a1');
				data = await changed;
				same(data.changed.deselected, ['a1']);
				assert.equal($(anchor('a1')).hasClass('jstree-clicked'), false);
				assert.equal($(anchor('a1')).attr('aria-selected'), 'false');

				t.select_all();
				assert.equal(t.get_selected().length, 8);
				t.deselect_all();
				same(t.get_selected(), []);
				assert.equal($('#tree .jstree-clicked').length, 0);
			});

			it('disables, hides and changes nodes', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() } });
				t.disable_node('a1');
				assert.equal(t.is_disabled('a1'), true);
				assert.equal($(anchor('a1')).hasClass('jstree-disabled'), true);
				assert.equal($(anchor('a1')).attr('aria-disabled'), 'true');
				mouse(env, anchor('a1'), 'click');
				same(t.get_selected(), [], 'disabled nodes can not be clicked');
				t.enable_node('a1');
				assert.equal(t.is_disabled('a1'), false);
				assert.equal($(anchor('a1')).hasClass('jstree-disabled'), false);

				t.hide_node('c');
				assert.equal(t.is_hidden('c'), true);
				assert.equal($('#c').hasClass('jstree-hidden'), true);
				t.show_node('c');
				assert.equal(t.is_hidden('c'), false);

				t.set_text('c', 'Cranberry');
				assert.equal(t.get_text('c'), 'Cranberry');
				assert.equal($(anchor('c')).text(), 'Cranberry');

				t.set_icon('c', 'http://localhost/icon.png');
				assert.match($(anchor('c')).children('.jstree-themeicon').attr('style') || '', /icon\.png/);
				assert.equal($(anchor('c')).children('.jstree-themeicon').hasClass('jstree-themeicon-custom'), true);
				t.set_icon('c', 'my-icon');
				assert.equal($(anchor('c')).children('.jstree-themeicon').hasClass('my-icon'), true);
				assert.equal($(anchor('c')).children('.jstree-themeicon').attr('style') || '', '');
				t.hide_icon('c');
				assert.equal(t.get_icon('c'), false);

				t.set_id('c', 'cc');
				assert.equal(t.get_node('c'), false);
				assert.equal(t.get_text('cc'), 'Cranberry');
				assert.ok(env.document.getElementById('cc'));
			});

			it('navigates the model', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() } });
				same(t.get_path('a21'), ['Alpha', 'Avocado', 'Hass']);
				assert.equal(t.get_path('a21', '/'), 'Alpha/Avocado/Hass');
				same(t.get_path('a21', false, true), ['a', 'a2', 'a21']);
				assert.equal(t.get_next_dom('a1')[0].id, 'a2');
				assert.equal(t.get_prev_dom('a2')[0].id, 'a1');
				assert.equal(t.get_next_dom('a2')[0].id, 'b', 'skips closed children');
				assert.equal(t.is_parent('a2'), true);
				assert.equal(t.is_leaf('a1'), true);
				assert.equal(t.is_loaded('a2'), true);
				same(t.get_node('a').children_d.sort(), ['a1', 'a2', 'a21', 'a22']);

				const json = t.get_json('a2');
				assert.equal(json.text, 'Avocado');
				same(json.children.map(function (c) { return c.id; }), ['a21', 'a22']);
				assert.equal(t.get_json('#', { flat: true }).length, 8);
				const noState = t.get_json('a1', { no_state: true, no_data: true, no_li_attr: true, no_a_attr: true });
				assert.equal(noState.state, undefined);
				assert.equal(noState.data, false);
				assert.equal(noState.li_attr, undefined);
			});

			it('creates nodes when check_callback allows it', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() } });
				assert.equal(t.create_node('c', { id: 'blocked', text: 'nope' }), false);
				assert.equal(t.last_error().error, 'check');
				t.settings.core.check_callback = true;
				const created = nextEvent(env, '#tree', 'create_node.jstree');
				assert.equal(t.create_node('a', { id: 'new', text: 'New' }, 'first'), 'new');
				assert.equal((await created).parent, 'a');
				assert.equal(t.get_node('a').children[0], 'new');
				assert.ok(anchor('new'));
			});

			it('saves and restores state', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() } });
				t.open_node('a2');
				t.select_node('a21');
				const state = t.get_state();
				same(state.core.open.sort(), ['a', 'a2']);
				same(state.core.selected, ['a21']);

				t.close_all();
				t.deselect_all();
				const restored = nextEvent(env, '#tree', 'set_state.jstree');
				t.set_state(JSON.parse(JSON.stringify(state)));
				await restored;
				assert.equal(t.is_open('a2'), true);
				same(t.get_selected(), ['a21']);
			});

			it('refreshes while keeping state', async function () {
				const t = await createTree(env, '#tree', { core: { data: function (node, cb) { cb(sample()); } } });
				t.open_node('b');
				t.select_node('b1');
				const refreshed = nextEvent(env, '#tree', 'refresh.jstree');
				t.refresh();
				await refreshed;
				assert.equal(t.is_open('b'), true);
				same(t.get_selected(), ['b1']);
				assert.ok(anchor('b1'));
			});

			it('refreshes a tree built from a static data array', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() } });
				t.open_node('b');
				t.select_node('b1');
				const refreshed = nextEvent(env, '#tree', 'refresh.jstree');
				t.refresh();
				await refreshed;
				assert.equal(t.is_open('b'), true);
				same(t.get_selected(), ['b1']);
				assert.ok(anchor('b1'));
				same(t.get_node('a').children_d.sort(), ['a1', 'a2', 'a21', 'a22']);
			});

			it('does not modify the options object or the data it is given', async function () {
				const options = { core: { data: sample(), multiple: false }, plugins: ['checkbox'] };
				const t = await createTree(env, '#tree', options);
				same(Object.keys(options.core).sort(), ['data', 'multiple']);
				assert.deepStrictEqual(options.core.data, sample(), 'data array is left as it was');
				assert.equal(t.settings.core.data, options.core.data, 'data is not copied');
				assert.equal(t.settings.core.multiple, false);
				t.check_all();
				t.open_all();
				t.refresh();
				assert.deepStrictEqual(options.core.data, sample());
			});

			it('can build two trees from the same data', async function () {
				const data = sample();
				const t1 = await createTree(env, '#tree', { core: { data: data } });
				const t2 = await createTree(env, '#other', { core: { data: data } });
				const texts = function (t) { return JSON.stringify(t.get_json('#', { flat: true }).map(function (n) { return n.text; })); };
				assert.equal(texts(t2), texts(t1));
				assert.equal(t2.get_node('#').children_d.length, 8);
			});

			it('does not modify data returned from a callback', async function () {
				const served = sample();
				const t = await createTree(env, '#tree', { core: { data: function (node, cb) { cb(served); } } });
				t.open_all();
				assert.deepStrictEqual(served, sample());
				const refreshed = nextEvent(env, '#tree', 'refresh.jstree');
				t.refresh();
				await refreshed;
				assert.equal(t.get_node('#').children_d.length, 8);
			});

			it('keeps the source object as node.original without children and data', async function () {
				const data = [{ id: 'x', text: 'X', custom: 42, data: { y: 1 }, state: { opened: true }, children: [{ id: 'x1', text: 'X1' }] }];
				const t = await createTree(env, '#tree', { core: { data: data } });
				const original = t.get_node('x').original;
				same(original, { id: 'x', text: 'X', custom: 42, state: { opened: true } });
				assert.notEqual(original, data[0]);
				assert.notEqual(original.state, data[0].state);
				same(t.get_node('x').data, { y: 1 });
				same(t.get_node('x').children, ['x1']);
			});

			it('loads flat (id / parent) data and reloads it the same way', async function () {
				const flat = [
					{ id: 'p', parent: '#', text: 'Parent', state: { opened: true } },
					{ id: 'k1', parent: 'p', text: 'Kid 1' },
					{ id: 'k2', parent: 'p', text: 'Kid 2' },
					{ id: 'q', parent: '#', text: 'Other' }
				];
				const before = JSON.parse(JSON.stringify(flat));
				const t = await createTree(env, '#tree', { core: { data: flat } });
				same(t.get_node('#').children, ['p', 'q']);
				same(t.get_node('p').children, ['k1', 'k2']);
				assert.equal(t.get_node('k1').original.parent, 'p');
				assert.deepStrictEqual(flat, before, 'flat data is left as it was');
				const refreshed = nextEvent(env, '#tree', 'refresh.jstree');
				t.refresh();
				await refreshed;
				same(t.get_node('p').children, ['k1', 'k2'], 'no duplicate children after a reload');
				same(t.get_node('#').children_d.sort(), ['k1', 'k2', 'p', 'q']);
				assert.ok(anchor('k2'));
			});

			it('does not modify the object given to create_node', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample(), check_callback: true } });
				const node = { id: 'n', text: 'New', data: { z: 1 }, children: [{ id: 'n1', text: 'New child' }] };
				t.create_node('c', node);
				same(t.get_node('n').children, ['n1']);
				same(node, { id: 'n', text: 'New', data: { z: 1 }, children: [{ id: 'n1', text: 'New child' }] });
			});

			it('lazy loads children from a data callback', async function () {
				const calls = [];
				const t = await createTree(env, '#tree', { core: { data: function (node, cb) {
					calls.push(node.id);
					if (node.id === '#') { cb.call(this, [{ id: 'root', text: 'Root', children: true }]); }
					else { setTimeout(function () { cb([{ id: node.id + '-1', text: 'one' }, { id: node.id + '-2', text: 'two', children: true }]); }, 5); }
				} } });
				same(calls, ['#']);
				assert.equal(t.is_loaded('root'), false);
				const loaded = nextEvent(env, '#tree', 'load_node.jstree');
				t.open_node('root');
				assert.equal($('#root').hasClass('jstree-loading'), true);
				assert.equal($(anchor('root')).attr('aria-busy'), 'true');
				const data = await loaded;
				assert.equal(data.status, true);
				same(calls, ['#', 'root']);
				same(t.get_node('root').children, ['root-1', 'root-2']);
				assert.equal($('#root').hasClass('jstree-loading'), false);
				assert.equal($(anchor('root')).attr('aria-busy'), 'false');
				await wait(10);
				assert.equal(t.is_open('root'), true);
				assert.ok(anchor('root-2'));
			});

			it('handles mouse clicks, ctrl+clicks and double clicks', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample(), animation: false } });
				mouse(env, anchor('a1'), 'click');
				same(t.get_selected(), ['a1']);
				mouse(env, anchor('c'), 'click');
				same(t.get_selected(), ['c'], 'a plain click replaces the selection');
				mouse(env, anchor('a1'), 'click', { ctrlKey: true });
				same(t.get_selected().sort(), ['a1', 'c'], 'ctrl+click adds to the selection');
				mouse(env, anchor('a1'), 'click', { ctrlKey: true });
				same(t.get_selected(), ['c'], 'ctrl+click removes from the selection');

				mouse(env, $('#a2 > .jstree-ocl')[0], 'click');
				assert.equal(t.is_open('a2'), true, 'clicking the expander opens');
				mouse(env, $('#a2 > .jstree-ocl')[0], 'click');
				assert.equal(t.is_open('a2'), false, 'clicking the expander closes');

				mouse(env, anchor('b'), 'dblclick');
				assert.equal(t.is_open('b'), true, 'double click opens');
				mouse(env, anchor('b'), 'dblclick');
				assert.equal(t.is_open('b'), false, 'double click closes');

				const hovered = nextEvent(env, '#tree', 'hover_node.jstree');
				mouse(env, anchor('c'), 'mouseover');
				assert.equal((await hovered).node.id, 'c');
				assert.equal($(anchor('c')).hasClass('jstree-hovered'), true);
				mouse(env, anchor('c'), 'mouseout');
				assert.equal($(anchor('c')).hasClass('jstree-hovered'), false);
			});

			it('respects multiple: false', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample(), multiple: false } });
				mouse(env, anchor('a1'), 'click');
				mouse(env, anchor('c'), 'click', { ctrlKey: true });
				same(t.get_selected(), ['c']);
			});

			it('supports keyboard navigation with native key events', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample(), animation: false } });
				anchor('a').focus();
				assert.equal(focused(), 'a');
				assert.equal($(anchor('a')).hasClass('jstree-hovered'), true, 'focus hovers the node');

				key(env, anchor('a'), 'keydown', KEY.down);
				assert.equal(focused(), 'a1');
				key(env, anchor('a1'), 'keydown', KEY.down);
				assert.equal(focused(), 'a2');

				key(env, anchor('a2'), 'keydown', KEY.right);
				assert.equal(t.is_open('a2'), true, 'right opens a closed node');
				assert.equal(focused(), 'a2');
				key(env, anchor('a2'), 'keydown', KEY.right);
				assert.equal(focused(), 'a21', 'right on an open node moves to its first child');
				key(env, anchor('a21'), 'keydown', KEY.left);
				assert.equal(focused(), 'a2', 'left on a child moves to its parent');
				key(env, anchor('a2'), 'keydown', KEY.left);
				assert.equal(t.is_open('a2'), false, 'left closes an open node');

				key(env, anchor('a2'), 'keydown', KEY.up);
				assert.equal(focused(), 'a1');
				key(env, anchor('a1'), 'keydown', KEY.end);
				assert.equal(focused(), 'c');
				key(env, anchor('c'), 'keydown', KEY.home);
				assert.equal(focused(), 'a');

				const down = key(env, anchor('a'), 'keydown', KEY.down);
				assert.equal(down.defaultPrevented, true, 'handled keys do not scroll the page');

				key(env, anchor('a1'), 'keydown', KEY.enter);
				same(t.get_selected(), ['a1'], 'enter selects');
				key(env, anchor('a1'), 'keydown', KEY.down);
				key(env, anchor('a2'), 'keydown', KEY.space, { ctrlKey: true });
				same(t.get_selected().sort(), ['a1', 'a2'], 'ctrl+space adds to the selection');

				key(env, anchor('a2'), 'keydown', KEY.star);
				assert.equal(t.is_open('b'), true, '* opens all');
			});

			it('finds nodes by typing', async function () {
				await createTree(env, '#tree', { core: { data: sample() } });
				anchor('a').focus();
				key(env, anchor('a'), 'keypress', 'c'.charCodeAt(0));
				assert.equal(focused(), 'c');
				await wait(550); // typed words reset after 500ms
				key(env, anchor('c'), 'keypress', 'a'.charCodeAt(0));
				assert.equal(focused(), 'a', 'a letter wraps around to the start');
				key(env, anchor('a'), 'keypress', 'a'.charCodeAt(0));
				assert.equal(focused(), 'a1', 'repeating a letter cycles through matches');
				await wait(550);
				key(env, anchor('a1'), 'keypress', 'a'.charCodeAt(0));
				key(env, anchor('a1'), 'keypress', 'v'.charCodeAt(0));
				assert.equal(focused(), 'a2', 'several letters match a whole word');
			});

			it('supports a custom keyboard map', async function () {
				const pressed = [];
				const t = await createTree(env, '#tree', { core: { data: sample(), keyboard: {
					'ctrl-shift-x': function (e) { pressed.push(this.get_node(e.currentTarget).id); }
				} } });
				anchor('c').focus();
				key(env, anchor('c'), 'keydown', 'X'.charCodeAt(0), { ctrlKey: true, shiftKey: true });
				same(pressed, ['c']);
				key(env, anchor('c'), 'keydown', KEY.down);
				assert.equal(focused(), 'c', 'defaults are replaced');
				assert.equal(t.get_node('c').id, 'c');
			});

			it('ignores F2 (no inline editing in this build)', async function () {
				await createTree(env, '#tree', { core: { data: sample() } });
				anchor('c').focus();
				const ev = key(env, anchor('c'), 'keydown', 113);
				assert.equal(ev.defaultPrevented, false);
				assert.equal(focused(), 'c');
			});

			it('can be destroyed and recreated', async function () {
				$('#tree').html('<ul><li id="x">X</li></ul>');
				const t = await createTree(env, '#tree');
				assert.equal(t.get_text('x'), 'X');
				t.destroy();
				assert.equal($('#tree').jstree(true), false);
				assert.equal($('#tree').hasClass('jstree'), false);
				assert.equal($('#tree').html(), '', 'container is emptied');
				const t2 = await createTree(env, '#tree', { core: { data: sample() } });
				assert.notEqual(t2, t);
				assert.equal(t2.get_text('a'), 'Alpha');
			});

			it('keeps several independent instances', async function () {
				const t1 = await createTree(env, '#tree', { core: { data: sample() } });
				const t2 = await createTree(env, '#other', { core: { data: [{ id: 'o', text: 'Other' }] } });
				assert.notEqual(t1, t2);
				t2.select_node('o');
				same(t1.get_selected(), []);
				assert.equal($.jstree.reference('o'), t2);
			});
		});
	}
}
