if cond then [else] -> then|else
quote statement -> statement
def symbol meaning -> meaning
block statement... -> statement[-1]
block! statement... -> statement[-1]
lambda params statement... -> function
  parameters must be valid javascript symbols
lambda! params statement... -> function
eval string -> anything
. container index -> value
load definitions [context] -> context
unload context -> undefined

list thing... -> [thing...]
head list -> list[0]
rest list -> list[1:]
type thing -> type
get container index default -> container[index]|default
set container index value -> value
append (thing|list)... -> list
concat string... -> string
+ number... -> number
- number... -> number
* number... -> number
/ number... -> number
> number number -> boolean
< number number -> boolean
>= number number -> boolean
>= number number -> boolean
== number number -> boolean
!= number number -> boolean
mapping ((key value)...) -> {key: value...}
keys container -> [index]
values container -> [thing]
new class thing... -> instance
react tag thing... -> React.Element
vis React.Element -> GeneratedElement
id thing -> thing
config -> React.Element
node urn -> string
nodes [owner [name]] -> [string]
save urn string -> string
http.get url params -> string
edit [string] -> React.Element

editor:
obj.text
   .vis
   .defs

(def editor (lambda (node_arn)
  (def o {
    "text": (node node_arn)
    "vis": (vis (react "div" "heya"))
  })
  (console.log o)
  (set o "defs" {
    "editor::save": (lambda ()
      (save node_arn o.text))
  })
  (console.log o)
  (set o "context" (load o.defs global))
  (console.log o)
  o
))
