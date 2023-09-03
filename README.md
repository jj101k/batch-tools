# batch-tools

Tools for doing batch operations in Javascript/Typescript.

The raison d'etre here is that often from a _code_ perspective you want to write
individual calls to something that takes a while - something that returns a
promise - but from a _program_ perspective you want them to be grouped together.
This provides a solution to that, with limitations.

# Guideline

You probably want to do:

```js
import {Decorator as PSLL} from "promise-stateful-lazy-loader"

@PSLL.lazyStates()
class DecoratedClass {
    readonly buffer = new LoadBufferCollection(this.simpleBatchFunction.bind(this), {timeoutMs: 5})

    @PSLL.lazyState(() => getFoo("bar"))
    bar!: string

    getFoo(bar) {
        if(this.cache[bar] === undefined) {
            this.cache[bar] = null
            buffer.add(bar).then(r => this.cache[bar] = r, e => {console.error(e)})
        }
        return this.cache[bar]
    }

    simpleBatchFunction(items: string[]) {
        return fetch("/bar?" + items.join("+"))
    }
}
```

# Things You Can Do Here

1. Combine a series of separate calls into one back-end call. This is for things which
   are _expensive_ to do individually but not so expensive to do in a batch -
   although you might have other reasons like rate limits.
2. Queue extra back-end calls. This is for cases like simultaneous usage limits

## Combining calls

From:

```js
doOneThing(c) {
    return this.doMyThing(c.item)
}
doTheThings() {
    for(const item of items) {
        results.push(await this.doMyThing(item))
    }
    return results
}
doMyThing(item) {
    return fetch({method: "POST", url: "/", data: {getResult: item}})
}
```

To:

```js
doOneThing(c) {
    return (await this.doMyThing(c.item))[0]
}
doTheThings(items) {
    const promises = []
    for(const item of items) {
        promises.push(this.doMyThing(item))
    }
    return Promise.all(promises).map(r => r[0])
}
@group(1, 10)
doMyThing(...items) {
    return fetch({method: "POST", url: "/", data: {getAllResults: items}})
}
```

Usually it'll make more sense for you to use a method which accepts a batch
anyway. Sometimes it won't.

```js
doTheThings() {
    const promises = []
    for(const item of items) {
        promises.push(this.doMyThing(item))
    }
    return Promise.all(promises)
}
doMyThing = new Batch(this, "doMultipleThings").single
doMultipleThings(items) {
    return fetch({method: "POST", url: "/", data: {getAllResults: items}})
}
```

You might want to batch on an _instance_ entirely - eg. if it's a singleton - or
on a _static method_, or on an instance targetting a static method. If you're
thinking of using a plain function, that's not going to be supported.

Instance:

```js
doMyThing = new Batch(this, "doMultipleThings").single
```

Static:

```js
static doMyThing = new Batch(this, "doMultipleThings").single
```

Instance-to-static:

```js
doMyThing = new Batch(SomeClass, "doMultipleThings").single
```

## Basic setup

The Batch constructor takes an _object_ and a _key of that object_, given that
the key is a function mapping `X[]` to `Promise<Y[]>`.

There are a couple of special cases:

1. You might have `...X[]` as the argument. If that's the case, `Batch.Spread`
   will do the job.
2. You might have a `Promise<void>` return. if that's the case, `Batch.Void`
   will do it.

Behind the scenes, the batch class _actually_ wraps the batch call in a method
on the batch class itself, so if you need to do arbitrary mappings you can.

# Limitations

## Loops

If you're using `await` on a batch call in a loop, you won't gain any benefit.
There's not a problem with hitting an `await` per se, but if you want it to send
**a+b+c** yet wait to get the result for **a** before you even ask for **b**,
it's just never going to be possible.

Separate Javascript execution contexts are fine however, including if they
`await` in them - so if a user _clicks_ **a** then **b**, it'll reliably work
(unless you go out of your way to prevent that).

The recommended workaround for loops is to push onto an array of promises, then
`await Promise.all(promises)` after the loop.

If you have lengthy loop code, eg:

```js
for(const x of y) {
    const z = await this.doMyExpensiveThing(x)
    this.doAnotherThing(z)
    this.andAnother(z)
}
```

...you can either use a second, separate loop (recommended):

```js
const zPromises = []
for(const x of y) {
    zPromises.push(this.doMyExpensiveThing(x))
}
for(const zP of zPromises) {
    const z = await zP
    this.doAnotherThing(z)
    this.andAnother(z)
}
```

or use plain `.then()`:

```js
const promises = []
for(const x of y) {
    promises.push(
        this.doMyExpensiveThing(x).then(z => {
            this.doAnotherThing(z)
            this.andAnother(z)
        })
    )
}
await Promise.all(promises)
```

or, if you're feeling fancy, use an ad-hoc async function:

```js
const promises = []
for(const x of y) {
    promises.push((async () => {
        const z = await this.doMyExpensiveThing(x)
        this.doAnotherThing(z)
        this.andAnother(z)
    })())
}
await Promise.all(promises)
```

## Promise rejection

The batch will either entirely succeed or entirely fail, from the perspective of
the batch infrastructure. More fine-grained results aren't supported at this
time.

## Timing

You might have noticed that a key datum you're expected to provide is the _wait
time_. If you know you're going to be all done within one or two consecutive
Javascript execution passes, this can be zero, but most of the time that's not
practical - you probably want it to work across several passes.

So there's a fixed amount of time before a partial batch is sent, and that's the
time value. This does fundamentally add latency - if you have a 10ms call you
probably don't want to wait a minimum of 100ms to make it - but most of the time
if there's a singular delay of up to 200ms, the user won't notice.