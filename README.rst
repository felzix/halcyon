Halcyon
=======
hal·cy·on
/'halsēən/
adjective
1.
denoting a period of time in the past that was idyllically happy and peaceful.
"the halcyon days of the mid-1980s, when profits were soaring"
synonyms:	happy, golden, idyllic, carefree, blissful, joyful, joyous, contented; flourishing,
thriving, prosperous, successful; serene, calm


This project is a web-based terminal intended as the next stage in productive UI.

Setup
-----
To set up the repo, first install all dependencies:

    npm i

Every time you use Halcyon, run these commands:

    node proxy-server.js
    node node-server.js

For development, also run this command:

    ./node_modules/.bin/webpack --watch

TODO
====
Loading doesn't work right.

When loading into global, this.globalContext shoulws a child, which is wrong. It should show a
parent.

What's really weird is that `global` in the interpreter shows a parent, not a child. Which is
correct.

But that's not really the weird part. The weird part is that these should refer to exactly the same
data structure but somehow do not. The "uid" for both is "default" even though they have different
values for "uid". This makes no sense.
