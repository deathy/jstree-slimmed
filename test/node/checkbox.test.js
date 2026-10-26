'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JQUERY, BUILDS, createEnv, createTree, nextEvent, mouse, wait, sample, same } = require('./helpers');

for (const jq of JQUERY) {
	for (const build of BUILDS) {
		describe('checkbox - ' + jq.name + ' - ' + build, function () {
			let env, $;
			beforeEach(function () {
				env = createEnv(jq, build, { body: '<div id="tree"></div>' });
				$ = env.$;
			});
			afterEach(function () {
				assert.deepStrictEqual(env.errors, [], 'no uncaught errors');
				env.window.close();
			});

			function anchor(id) { return env.document.getElementById(id + '_anchor'); }

			it('renders checkboxes', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'] });
				assert.equal($(anchor('a1')).children('.jstree-checkbox').length, 1);
				assert.equal($('#tree').hasClass('jstree-checkbox-selection'), true, 'whole node selection by default');
				t.hide_checkboxes();
				assert.equal($('#tree .jstree-container-ul').hasClass('jstree-no-checkboxes'), true);
				t.show_checkboxes();
				assert.equal($('#tree .jstree-container-ul').hasClass('jstree-no-checkboxes'), false);
			});

			it('cascades down and up with three_state', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'] });
				t.check_node('a2');
				assert.equal(t.is_checked('a21'), true, 'children are checked');
				assert.equal(t.is_checked('a22'), true);
				assert.equal(t.is_checked('a'), false);
				same(t.get_undetermined(), ['a']);
				await wait(60); // undetermined state is drawn with a delay
				assert.equal($(anchor('a')).children('.jstree-undetermined').length, 1, 'parent shows as undetermined');
				same(t.get_top_checked(), ['a2']);
				same(t.get_bottom_checked().sort(), ['a21', 'a22']);

				t.check_node('a1');
				assert.equal(t.is_checked('a'), true, 'parent is checked once all children are');
				same(t.get_top_checked(), ['a']);
				same(t.get_undetermined(), []);

				t.uncheck_node('a21');
				assert.equal(t.is_checked('a'), false);
				assert.equal(t.is_checked('a2'), false);
				same(t.get_checked().sort(), ['a1', 'a22']);
				same(t.get_undetermined().sort(), ['a', 'a2']);
			});

			it('checks and unchecks everything', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'] });
				t.check_all();
				assert.equal(t.get_checked().length, 8);
				t.uncheck_all();
				same(t.get_checked(), []);
				assert.equal($('#tree .jstree-clicked').length, 0);
			});

			it('ties checking to selection by default', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox', 'changed'] });
				const changed = nextEvent(env, '#tree', 'changed.jstree');
				mouse(env, anchor('c'), 'click');
				const data = await changed;
				same(data.changed.selected, ['c']);
				assert.equal(t.is_checked('c'), true);
				assert.equal(t.is_selected('c'), true);
				assert.equal($(anchor('c')).attr('aria-selected'), 'true');
				mouse(env, anchor('a1'), 'click');
				same(t.get_checked().sort(), ['a1', 'c'], 'clicks toggle instead of replacing the selection');
				mouse(env, anchor('c'), 'click');
				same(t.get_checked(), ['a1']);
			});

			it('keeps checking separate from selection with tie_selection: false', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'], checkbox: { tie_selection: false, whole_node: false } });
				const checked = nextEvent(env, '#tree', 'check_node.jstree');
				mouse(env, $(anchor('c')).children('.jstree-checkbox')[0], 'click');
				assert.equal((await checked).node.id, 'c');
				assert.equal(t.is_checked('c'), true);
				same(t.get_selected(), []);
				assert.equal($(anchor('c')).hasClass('jstree-checked'), true);

				mouse(env, anchor('a1'), 'click');
				same(t.get_selected(), ['a1'], 'clicking the text selects');
				same(t.get_checked(), ['c'], 'clicking the text does not check');
			});

			it('supports cascade without three_state', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'], checkbox: { three_state: false, cascade: 'down' } });
				t.check_node('a');
				same(t.get_checked().sort(), ['a', 'a1', 'a2', 'a21', 'a22']);
				t.uncheck_node('a1');
				assert.equal(t.is_checked('a'), true, 'no upward cascade');
			});

			it('does not cascade into disabled checkboxes when told not to', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'], checkbox: { cascade_to_disabled: false } });
				t.disable_node('a21');
				t.check_node('a2');
				assert.equal(t.is_checked('a22'), true);
				assert.equal(t.is_checked('a21'), false);
				t.open_node('a2');
				t.disable_checkbox('a22');
				assert.equal($(anchor('a22')).children('.jstree-checkbox-disabled').length, 1);
			});

			it('keeps checked state through get_state / set_state', async function () {
				const t = await createTree(env, '#tree', { core: { data: sample() }, plugins: ['checkbox'], checkbox: { tie_selection: false } });
				t.check_node('b');
				const state = t.get_state();
				same(state.checkbox, ['b', 'b1']);
				t.uncheck_all();
				const restored = nextEvent(env, '#tree', 'set_state.jstree');
				t.set_state(JSON.parse(JSON.stringify(state)));
				await restored;
				same(t.get_checked().sort(), ['b', 'b1']);
			});
		});
	}
}
