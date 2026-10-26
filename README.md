# jstree-slimmed

Hard fork with most features except basic tree and checkboxes removed.

Probably nobody should be using this, you probably want the great original [jsTree](https://github.com/vakata/jstree)

## Versions and jQuery

| jstree-slimmed | jQuery |
| --- | --- |
| `4.x-slimmed` | 4.x (`^4.0.0`) |
| `3.3.x-slimmed` (last: `3.3.20-slimmed`) | 3.x (`^3.5.0`) |

From `4.0.0-slimmed` on, jQuery is a peer dependency: install it next to jstree-slimmed and jstree registers itself on that jQuery instance.

```
npm install jquery@4 @deathy/jstree-slimmed
```

Still on jQuery 3? Stay on `3.3.20-slimmed`:

```
npm install jquery@3 @deathy/jstree-slimmed@3.3.20-slimmed
```

Use the full jQuery build, not the slim one, if you load nodes over AJAX (`core.data.url` / massload `url`).

Only the core and the `checkbox`, `changed` and `massload` plugins are included.

## Development

```
npm install
npm run build   # grunt: lint, build dist/, themes
npm test        # node:test + jsdom, runs against dist/ with both jQuery 4 and jQuery 3
```

# jstree

[jsTree](http://www.jstree.com/) is jquery plugin, that provides interactive trees. It is absolutely free, [open source](https://github.com/vakata/jstree) and distributed under the MIT license.

jsTree is easily extendable, themable and configurable, it supports HTML & JSON data sources, AJAX & async callback loading.

jsTree functions properly in either box-model (content-box or border-box), can be loaded as an AMD module, and has a built in mobile theme for responsive design, that can easily be customized. It uses jQuery's event system, so binding callbacks on various events in the tree is familiar and easy.

You also get:
 * drag & drop support
 * keyboard navigation
 * inline edit, create and delete
 * tri-state checkboxes
 * fuzzy searching
 * customizable node types

_For more information, examples and API docs head on over to [the wiki page](https://github.com/vakata/jstree/wiki) and [jstree.com](http://www.jstree.com)_.
_Feel free to ask any questions on the [discussions board](https://github.com/vakata/jstree/discussions)._
_The PHP demos are now in a [separate repository](https://github.com/vakata/jstree-php-demos)._

## License & Contributing

_Please do NOT edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "src" subdirectory!_

If you want to you can always [sponsor me](https://github.com/sponsors/vakata) or [donate a small amount][paypal] to help the development of jstree.

[paypal]: https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=paypal@vakata.com&currency_code=USD&amount=&return=http://jstree.com/donation&item_name=Buy+me+a+coffee+for+jsTree

Copyright (c) 2020 Ivan Bozhanov (http://vakata.com)

Licensed under the [MIT license](http://www.opensource.org/licenses/mit-license.php).
