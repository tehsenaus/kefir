(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! kefir - 0.1.6
 *  https://github.com/pozadi/kefir
 */
(function(global){
  "use strict";

function noop(){}

function id(x){return x}

function own(obj, prop){
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function toArray(arrayLike){
  if (arrayLike instanceof Array) {
    return arrayLike;
  } else {
    return Array.prototype.slice.call(arrayLike);
  }
}

function createObj(proto) {
  var F = function(){};
  F.prototype = proto;
  return new F();
}

function extend() {
  var objects = toArray(arguments);
  if (objects.length === 1) {
    return objects[0];
  }
  var result = objects.shift();
  for (var i = 0; i < objects.length; i++) {
    for (var prop in objects[i]) {
      if(own(objects[i], prop)) {
        result[prop] = objects[i][prop];
      }
    }
  }
  return result;
}

function inherit(Child, Parent) { // (Child, Parent[, mixin1, mixin2, ...])
  Child.prototype = createObj(Parent.prototype);
  Child.prototype.constructor = Child;
  for (var i = 2; i < arguments.length; i++) {
    extend(Child.prototype, arguments[i]);
  }
  return Child;
}

function inheritMixin(Child, Parent) {
  for (var prop in Parent) {
    if (own(Parent, prop) && !(prop in Child)) {
      Child[prop] = Parent[prop];
    }
  }
  return Child;
}

function removeFromArray(array, value) {
  for (var i = 0; i < array.length;) {
    if (array[i] === value) {
      array.splice(i, 1);
    } else {
      i++;
    }
  }
}

function killInArray(array, value) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === value) {
      delete array[i];
    }
  }
}

function isAllDead(array) {
  for (var i = 0; i < array.length; i++) {
    /*jshint eqnull:true */
    if (array[i] != null) {
      return false;
    }
  }
  return true;
}

function firstArrOrToArr(args) {
  if (Object.prototype.toString.call(args[0]) === '[object Array]') {
    return args[0];
  }
  return toArray(args);
}

function restArgs(args, start, nullOnEmpty){
  if (args.length > start) {
    return Array.prototype.slice.call(args, start);
  }
  if (nullOnEmpty) {
    return null;
  } else {
    return [];
  }
}

function callSubscriber(subscriber, moreArgs){
  // subscriber = [
  //   eventName,
  //   fn,
  //   context,
  //   arg1,
  //   arg2,
  //   ...
  // ]
  var fn = subscriber[1];
  var context = subscriber[2];
  var args = restArgs(subscriber, 3);
  if (moreArgs){
    args = args.concat(toArray(moreArgs));
  }
  return fn.apply(context, args);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStream(stream){
  assert(stream instanceof Stream, "not a Stream: " + stream)
}

function assertProperty(property){
  assert(property instanceof Property, "not a Property: " + property)
}

function isFn(fn) {
  return typeof fn === "function";
}

function isEqualArrays(a, b){
  /*jshint eqnull:true */
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}



var Kefir = {};



// Special values

var NOTHING = Kefir.NOTHING = ['<nothing>'];
var END = Kefir.END = ['<end>'];
var NO_MORE = Kefir.NO_MORE = ['<no more>'];

// Example:
//   stream.__sendAny(Kefir.bunch(1, 2, Kefir.END))
Kefir.BunchOfValues = function(values){
  this.values = values;
}
Kefir.bunch = function() {
  return new Kefir.BunchOfValues(firstArrOrToArr(arguments));
}




// Observable

var Observable = Kefir.Observable = function Observable(onFirstIn, onLastOut){

  // __onFirstIn, __onLastOut can also be added to prototype of child classes
  if (isFn(onFirstIn)) {
    this.__onFirstIn = onFirstIn;
  }
  if (isFn(onLastOut)) {
    this.__onLastOut = onLastOut;
  }

  this.__subscribers = [];

}

inherit(Observable, Object, {

  __ClassName: 'Observable',

  toString: function(){
    return '[' + this.__ClassName + (this.__objName ? (' | ' + this.__objName) : '') + ']';
  },

  __onFirstIn: noop,
  __onLastOut: noop,

  __on: function(type /*,callback [, context [, arg1, arg2 ...]]*/){
    if (!this.isEnded()) {
      var firstValueSubscriber = (type === 'value' && !this.__hasSubscribers('value'));
      this.__subscribers.push(arguments);
      if (firstValueSubscriber) {
        this.__onFirstIn();
      }
    } else if (type === 'end') {
      callSubscriber(arguments);
    }
  },
  __off: function(type /*,callback [, context [, arg1, arg2 ...]]*/){
    if (!this.isEnded()) {
      for (var i = 0; i < this.__subscribers.length; i++) {
        if (isEqualArrays(this.__subscribers[i], arguments)) {
          this.__subscribers[i] = null;
        }
      }
      if (type === 'value' && !this.__hasSubscribers('value')) {
        this.__onLastOut();
      }
    }
  },
  __send: function(type /*[, arg1, arg2, ...]*/) {
    if (!this.isEnded()) {
      for (var i = 0; i < this.__subscribers.length; i++) {
        var subscriber = this.__subscribers[i];
        if (subscriber && subscriber[0] === type) {
          var result = callSubscriber(subscriber, restArgs(arguments, 1));
          if (result === NO_MORE) {
            this.__off.apply(this, subscriber)
          }
        }
      }
      if (type === 'end') {
        this.__clear();
      }
    }
  },
  __hasSubscribers: function(type) {
    if (this.isEnded()) {
      return false;
    }
    for (var i = 0; i < this.__subscribers.length; i++) {
      if (this.__subscribers[i] && this.__subscribers[i][0] === type) {
        return true;
      }
    }
    return false;
  },
  __clear: function() {
    this.__onLastOut();
    if (own(this, '__onFirstIn')) {
      this.__onFirstIn = null;
    }
    if (own(this, '__onLastOut')) {
      this.__onLastOut = null;
    }
    this.__subscribers = null;
  },


  __sendValue: function(x){
    this.__send('value', x);
  },
  __sendEnd: function(){
    this.__send('end');
  },
  __sendAny: function(x){
    if (x === END) {
      this.__sendEnd();
    } else if (x instanceof Kefir.BunchOfValues) {
      for (var i = 0; i < x.values.length; i++) {
        this.__sendAny(x.values[i]);
      }
    } else if (x !== Kefir.NOTHING) {
      this.__sendValue(x);
    }
  },


  onValue: function(){
    this.__on.apply(this, ['value'].concat(toArray(arguments)));
  },
  offValue: function(){
    this.__off.apply(this, ['value'].concat(toArray(arguments)));
  },
  onEnd: function(){
    this.__on.apply(this, ['end'].concat(toArray(arguments)));
  },
  offEnd: function(){
    this.__off.apply(this, ['end'].concat(toArray(arguments)));
  },

  // for Property
  onNewValue: function(){
    this.onValue.apply(this, arguments);
  },

  isEnded: function() {
    return !this.__subscribers;
  }


})




// Stream

var Stream = Kefir.Stream = function Stream(){
  Observable.apply(this, arguments);
}

inherit(Stream, Observable, {
  __ClassName: 'Stream'
})




// Property

var Property = Kefir.Property = function Property(onFirstIn, onLastOut, initial){
  Observable.call(this, onFirstIn, onLastOut);
  this.__cached = (typeof initial !== "undefined") ? initial : Kefir.NOTHING;
}

inherit(Property, Observable, {

  __ClassName: 'Property',

  hasCached: function(){
    return this.__cached !== Kefir.NOTHING;
  },
  getCached: function(){
    return this.__cached;
  },

  __sendValue: function(x) {
    if (!this.isEnded()){
      this.__cached = x;
    }
    Observable.prototype.__sendValue.call(this, x);
  },
  onNewValue: function(){
    this.__on.apply(this, ['value'].concat(toArray(arguments)));
  },
  onValue: function() {
    if ( this.hasCached() ) {
      callSubscriber(['value'].concat(toArray(arguments)), [this.__cached]);
    }
    this.onNewValue.apply(this, arguments);
  }

})



// Log

Observable.prototype.log = function(text) {
  if (!text) {
    text = this.toString();
  }
  function log(x){  console.log(text, x)  }
  this.onValue(log);
  this.onEnd(function(){  log(END)  });
}

// TODO
//
// Kefir.constant(x)



// Never

var neverObj = new Stream();
neverObj.__sendEnd();
neverObj.__objName = 'Kefir.never()'
Kefir.never = function() {
  return neverObj;
}




// Once

Kefir.OnceStream = function OnceStream(value){
  Stream.call(this);
  this.__value = value;
}

inherit(Kefir.OnceStream, Stream, {

  __ClassName: 'OnceStream',
  onValue: function(){
    if (!this.isEnded()) {
      callSubscriber(['value'].concat(toArray(arguments)), [this.__value]);
      this.__value = null;
      this.__sendEnd();
    }
  }

})

Kefir.once = function(x) {
  return new Kefir.OnceStream(x);
}





// fromBinder

Kefir.FromBinderStream = function FromBinderStream(subscribe){
  Stream.call(this);
  this.__subscribe = subscribe;
}

inherit(Kefir.FromBinderStream, Stream, {

  __ClassName: 'FromBinderStream',
  __onFirstIn: function(){
    var _this = this;
    this.__usubscriber = this.__subscribe(function(x){
      _this.__sendAny(x);
    });
  },
  __onLastOut: function(){
    if (isFn(this.__usubscriber)) {
      this.__usubscriber();
    }
    this.__usubscriber = null;
  },
  __clear: function(){
    Stream.prototype.__clear.call(this);
    this.__subscribe = null;
  }

})

Kefir.fromBinder = function(subscribe){
  return new Kefir.FromBinderStream(subscribe);
}

// TODO
//
// stream.skipWhile(f)
// observable.skip(n)
//
// observable.scan(seed, f)
// observable.diff(start, f)
//
// observable.skipDuplicates(isEqual)



var WithSourceStreamMixin = {
  __Constructor: function(source) {
    this.__source = source;
    source.onEnd(this.__sendEnd, this);
    if (source instanceof Property && this instanceof Property && source.hasCached()) {
      this.__handle(source.getCached());
    }
  },
  __handle: function(x){
    this.__sendAny(x);
  },
  __onFirstIn: function(){
    this.__source.onNewValue(this.__handle, this);
  },
  __onLastOut: function(){
    this.__source.offValue(this.__handle, this);
  },
  __clear: function(){
    Observable.prototype.__clear.call(this);
    this.__source = null;
  }
}





// observable.toProperty()

Kefir.PropertyFromStream = function PropertyFromStream(source, initial){
  Property.call(this, null, null, initial);
  this.__Constructor.call(this, source);
}

inherit(Kefir.PropertyFromStream, Property, WithSourceStreamMixin, {
  __ClassName: 'PropertyFromStream'
})

Stream.prototype.toProperty = function(initial){
  return new Kefir.PropertyFromStream(this, initial);
}

Property.prototype.toProperty = function(initial){
  if (typeof initial === "undefined") {
    return this
  } else {
    var prop = new Kefir.PropertyFromStream(this);
    prop.__sendValue(initial);
    return prop;
  }
}





// property.changes()
// TODO: tests

Kefir.ChangesStream = function ChangesStream(source){
  assertProperty(source);
  Stream.call(this);
  this.__Constructor.call(this, source);
}

inherit(Kefir.ChangesStream, Stream, WithSourceStreamMixin, {
  __ClassName: 'ChangesStream'
})

Property.prototype.changes = function() {
  return new Kefir.ChangesStream(this);
}






// Map

var MapMixin = {
  __Constructor: function(source, mapFn){
    if (source instanceof Property) {
      Property.call(this);
    } else {
      Stream.call(this);
    }
    this.__mapFn = mapFn;
    WithSourceStreamMixin.__Constructor.call(this, source);
  },
  __handle: function(x){
    this.__sendAny( this.__mapFn(x) );
  },
  __clear: function(){
    WithSourceStreamMixin.__clear.call(this);
    this.__mapFn = null;
  }
}
inheritMixin(MapMixin, WithSourceStreamMixin);

Kefir.MappedStream = function MappedStream(){
  this.__Constructor.apply(this, arguments);
}

inherit(Kefir.MappedStream, Stream, MapMixin, {
  __ClassName: 'MappedStream'
});

Kefir.MappedProperty = function MappedProperty(){
  this.__Constructor.apply(this, arguments);
}

inherit(Kefir.MappedProperty, Property, MapMixin, {
  __ClassName: 'MappedProperty'
})

Stream.prototype.map = function(fn) {
  return new Kefir.MappedStream(this, fn);
}

Property.prototype.map = function(fn) {
  return new Kefir.MappedProperty(this, fn);
}





// Filter

Observable.prototype.filter = function(fn) {
  return this.map(function(x){
    if (fn(x)) {
      return x;
    } else {
      return NOTHING;
    }
  })
}




// TakeWhile

Observable.prototype.takeWhile = function(fn) {
  return this.map(function(x){
    if (fn(x)) {
      return x;
    } else {
      return END;
    }
  })
}




// Take

Observable.prototype.take = function(n) {
  return this.map(function(x){
    if (n-- > 0) {
      return x;
    } else {
      return END;
    }
  })
}

// TODO
//
// observable.flatMapLatest(f)
// observable.flatMapFirst(f)
//
// observable.zip(other, f)
//
// observable.awaiting(otherObservable)
//
// stream.concat(otherStream)
//
// Kefir.onValues(a, b [, c...], f)




// var PluggableMixin = {

//   __Constructor: function(){
//     this.__plugged = [];
//   },
//   __handlePlugged: function(i, value){
//     this.__sendAny(value);
//   },
//   __clear: function(){
//     this.__plugged = null;
//   }


// }





// Bus

Kefir.Bus = function Bus(){
  Stream.call(this);
  this.__plugged = [];
}

inherit(Kefir.Bus, Stream, {

  __ClassName: 'Bus',
  push: function(x){
    this.__sendAny(x)
  },
  plug: function(stream){
    if (!this.isEnded()) {
      this.__plugged.push(stream);
      if (this.__hasSubscribers('value')) {
        stream.onValue(this.__sendValue, this);
      }
      stream.onEnd(this.unplug, this, stream);
    }
  },
  unplug: function(stream){
    if (!this.isEnded()) {
      stream.offValue(this.__sendValue, this);
      removeFromArray(this.__plugged, stream);
    }
  },
  end: function(){
    this.__sendEnd();
  },
  __onFirstIn: function(){
    for (var i = 0; i < this.__plugged.length; i++) {
      this.__plugged[i].onValue(this.__sendValue, this);
    }
  },
  __onLastOut: function(){
    for (var i = 0; i < this.__plugged.length; i++) {
      this.__plugged[i].offValue(this.__sendValue, this);
    }
  },
  __clear: function(){
    Stream.prototype.__clear.call(this);
    this.__plugged = null;
    this.push = noop;
  }

});

Kefir.bus = function(){
  return new Kefir.Bus;
}





// FlatMap

Kefir.FlatMappedStream = function FlatMappedStream(sourceStream, mapFn){
  Stream.call(this)
  this.__sourceStream = sourceStream;
  this.__plugged = [];
  this.__mapFn = mapFn;
  sourceStream.onEnd(this.__sendEnd, this);
}

inherit(Kefir.FlatMappedStream, Stream, {

  __ClassName: 'FlatMappedStream',
  __plugResult: function(x){
    this.__plug(  this.__mapFn(x)  );
  },
  __onFirstIn: function(){
    this.__sourceStream.onValue(this.__plugResult, this);
    for (var i = 0; i < this.__plugged.length; i++) {
      this.__plugged[i].onValue(this.__sendValue, this);
    }
  },
  __onLastOut: function(){
    this.__sourceStream.offValue(this.__plugResult, this);
    for (var i = 0; i < this.__plugged.length; i++) {
      this.__plugged[i].offValue(this.__sendValue, this);
    }
  },
  __plug: function(stream){
    this.__plugged.push(stream);
    if (this.__hasSubscribers('value')) {
      stream.onValue(this.__sendValue, this);
    }
    stream.onEnd(this.__unplug, this, stream);
  },
  __unplug: function(stream){
    if (!this.isEnded()) {
      stream.offValue(this.__sendValue, this);
      removeFromArray(this.__plugged, stream);
    }
  },
  __clear: function(){
    Stream.prototype.__clear.call(this);
    this.__sourceStream = null;
    this.__mapFn = null;
    this.__plugged = null;
  }

})

Observable.prototype.flatMap = function(fn) {
  return new Kefir.FlatMappedStream(this, fn);
};








// Merge

Kefir.MergedStream = function MergedStream(){
  Stream.call(this)
  this.__sources = firstArrOrToArr(arguments);
  for (var i = 0; i < this.__sources.length; i++) {
    this.__sources[i].onEnd(this.__unplug, this, this.__sources[i]);
  }
}

inherit(Kefir.MergedStream, Stream, {

  __ClassName: 'MergedStream',
  __onFirstIn: function(){
    for (var i = 0; i < this.__sources.length; i++) {
      this.__sources[i].onNewValue(this.__sendValue, this);
    }
  },
  __onLastOut: function(){
    for (var i = 0; i < this.__sources.length; i++) {
      this.__sources[i].offValue(this.__sendValue, this);
    }
  },
  __unplug: function(stream){
    stream.offValue(this.__sendValue, this);
    removeFromArray(this.__sources, stream);
    if (this.__sources.length === 0) {
      this.__sendEnd();
    }
  },
  __clear: function(){
    Stream.prototype.__clear.call(this);
    this.__sources = null;
  }

});

Kefir.merge = function() {
  return new Kefir.MergedStream(firstArrOrToArr(arguments));
}

Stream.prototype.merge = function() {
  return Kefir.merge([this].concat(firstArrOrToArr(arguments)));
}









// Combine

Kefir.CombinedStream = function CombinedStream(sources, mapFn){
  Stream.call(this)

  this.__sources = sources;
  this.__cachedValues = new Array(sources.length);
  this.__hasCached = new Array(sources.length);
  this.__mapFn = mapFn;

  for (var i = 0; i < this.__sources.length; i++) {
    this.__sources[i].onEnd(this.__unplug, this, i);
  }

}

inherit(Kefir.CombinedStream, Stream, {

  __ClassName: 'CombinedStream',
  __onFirstIn: function(){
    for (var i = 0; i < this.__sources.length; i++) {
      if (this.__sources[i]) {
        this.__sources[i].onValue(this.__receive, this, i);
      }
    }
  },
  __onLastOut: function(){
    for (var i = 0; i < this.__sources.length; i++) {
      if (this.__sources[i]) {
        this.__sources[i].offValue(this.__receive, this, i);
      }
    }
  },
  __unplug: function(i){
    this.__sources[i].offValue(this.__receive, this, i);
    this.__sources[i] = null
    if (isAllDead(this.__sources)) {
      this.__sendEnd();
    }
  },
  __receive: function(i, x) {
    this.__hasCached[i] = true;
    this.__cachedValues[i] = x;
    if (this.__allCached()) {
      if (isFn(this.__mapFn)) {
        this.__sendAny(this.__mapFn.apply(null, this.__cachedValues));
      } else {
        this.__sendValue(this.__cachedValues.slice(0));
      }
    }
  },
  __allCached: function(){
    for (var i = 0; i < this.__hasCached.length; i++) {
      if (!this.__hasCached[i]) {
        return false;
      }
    }
    return true;
  },
  __clear: function(){
    Stream.prototype.__clear.call(this);
    this.__sources = null;
    this.__cachedValues = null;
    this.__hasCached = null;
    this.__mapFn = null;
  }

});

Kefir.combine = function(sources, mapFn) {
  return new Kefir.CombinedStream(sources, mapFn);
}

Observable.prototype.combine = function(sources, mapFn) {
  return Kefir.combine([this].concat(sources), mapFn);
}

// FromPoll

var FromPollStream = Kefir.FromPollStream = function FromPollStream(interval, sourceFn){
  Stream.call(this);
  this.__interval = interval;
  this.__intervalId = null;
  var _this = this;
  this.__bindedSend = function(){  _this.__sendAny(sourceFn())  }
}

inherit(FromPollStream, Stream, {

  __ClassName: 'FromPollStream',
  __onFirstIn: function(){
    this.__intervalId = setInterval(this.__bindedSend, this.__interval);
  },
  __onLastOut: function(){
    if (this.__intervalId !== null){
      clearInterval(this.__intervalId);
      this.__intervalId = null;
    }
  },
  __clear: function(){
    Stream.prototype.__clear.call(this);
    this.__bindedSend = null;
  }

});

Kefir.fromPoll = function(interval, fn){
  return new FromPollStream(interval, fn);
}



// Interval

Kefir.interval = function(interval, x){
  return new FromPollStream(interval, function(){  return x });
}



// Sequentially

Kefir.sequentially = function(interval, xs){
  xs = xs.slice(0);
  return new FromPollStream(interval, function(){
    if (xs.length === 0) {
      return END;
    }
    if (xs.length === 1){
      return Kefir.bunch(xs[0], END);
    }
    return xs.shift();
  });
}



// Repeatedly

Kefir.repeatedly = function(interval, xs){
  var i = -1;
  return new FromPollStream(interval, function(){
    return xs[++i % xs.length];
  });
}

// TODO
//
// // more underscore-style maybe?
// observable.delay(delay)
// observable.throttle(delay)
// observable.debounce(delay)
// observable.debounceImmediate(delay)
//
// Kefir.later(delay, value)


  if (typeof define === 'function' && define.amd) {
    define([], function() {
      return Kefir;
    });
    global.Kefir = Kefir;
  } else if (typeof module === "object" && typeof exports === "object") {
    module.exports = Kefir;
    Kefir.Kefir = Kefir;
  } else {
    global.Kefir = Kefir;
  }

}(this));
},{}],2:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');


describe("Bus", function(){



  it("push() works", function(done) {

    var bus = new Kefir.Bus;

    bus.push('no subscribers – will not be delivered');

    setTimeout(function(){
      bus.push(2);
      bus.end();
    }, 0);

    helpers.captureOutput(bus, function(values){
      expect(values).toEqual([1, 2]);
      done();
    });

    bus.push(1);

  }, 100);




  it("plug() works", function(done) {

    var mainBus = new Kefir.Bus;
    var source1 = new Kefir.Bus;
    var source2 = new Kefir.Bus;

    mainBus.plug(source1);

    source1.push('no subscribers – will not be delivered');

    setTimeout(function(){
      source2.push('not plugged – will not be delivered');
      source1.push(1);
      mainBus.plug(source2);
    }, 0);

    setTimeout(function(){
      source2.push(2);
      source1.push(3);
      source1.end();
    }, 0);

    setTimeout(function(){
      source2.push(4);
      mainBus.end();
    }, 0);

    helpers.captureOutput(mainBus, function(values){
      expect(values).toEqual([1, 2, 3, 4]);
      done();
    });

  }, 100);




  it("unplug() works", function(done) {

    var mainBus = new Kefir.Bus;
    var source = new Kefir.Bus;

    mainBus.plug(source);


    setTimeout(function(){
      source.push(1);
      mainBus.unplug(source);
    }, 0);

    setTimeout(function(){
      source.push(2);
      source.end();
      mainBus.end();
    }, 0);

    helpers.captureOutput(mainBus, function(values){
      expect(values).toEqual([1]);
      done();
    });

  }, 100);




});

},{"../../dist/kefir.js":1,"../test-helpers":21}],3:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".combine()", function(){

  it("simple case", function(done){

    var stream1 = helpers.sampleStream([1, 3, Kefir.END], 15);
    var stream2 = helpers.sampleStream([6, 5, Kefir.END], 20);

    // --1--3
    // ---6---5
    // ---7-9-8

    var combined = stream1.combine(stream2, function(s1, s2){
      return s1 + s2;
    })

    helpers.captureOutput(combined, function(values){
      expect(values).toEqual([7, 9, 8]);
      done();
    });

  }, 100);


  it("with property", function(done){

    var stream1 = helpers.sampleStream([1, 3, Kefir.END], 15);
    var stream2 = helpers.sampleStream([6, 5, Kefir.END], 20).toProperty(0);

    // --1--3
    // 0--6---5
    // --17-9-8

    var combined = stream1.combine(stream2, function(s1, s2){
      return s1 + s2;
    })

    helpers.captureOutput(combined, function(values){
      expect(values).toEqual([1, 7, 9, 8]);
      done();
    });

  }, 100);



  it("with temporary all unsubscribed", function(done){

    var bus1 = new Kefir.Bus;
    var bus2 = new Kefir.Bus;
    var combined = bus1.combine(bus2, function(a, b) { return a + b });

    helpers.captureOutput(combined.take(2), function(values){
      expect(values).toEqual([3, 5]);
    });

    bus1.push(1)
    bus2.push(2) // 1 + 2 = 3
    bus1.push(3) // 3 + 2 = 5
    expect(bus1.__hasSubscribers('value')).toBe(true);
    expect(bus2.__hasSubscribers('value')).toBe(true);
    bus2.push(4) // 3 + 4 = 7
    expect(bus1.__hasSubscribers('value')).toBe(false);
    expect(bus2.__hasSubscribers('value')).toBe(false);


    helpers.captureOutput(combined, function(values){
      expect(values).toEqual([9, 11]);
      done();
    });

    bus1.push(5) // 5 + 4 = 9
    bus2.push(6) // 5 + 6 = 11
    bus1.end()
    bus2.end()


  }, 100);



});

},{"../../dist/kefir.js":1,"../test-helpers":21}],4:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".filter()", function(){

  it("works", function(done){

    var stream = helpers.sampleStream([1, 2, 3, 4, Kefir.END]);
    var filtered = stream.filter(function(x){
      return x % 2 === 0;
    })

    helpers.captureOutput(filtered, function(values){
      expect(values).toEqual([2, 4]);
      done();
    });

  }, 100);



  it("works with properties", function(done){

    var property = helpers.sampleStream([1, 2, 3, 4, Kefir.END]).toProperty(6);

    var filtered = property.filter(function(x){
      return x % 2 === 0;
    })

    expect(filtered instanceof Kefir.Property).toBe(true);
    expect(filtered.getCached()).toBe(6);

    helpers.captureOutput(filtered, function(values){
      expect(values).toEqual([6, 2, 4]);
      done();
    });

  }, 100);



  it("works with properties 2", function(done){

    var property = helpers.sampleStream([1, 2, 3, 4, Kefir.END]).toProperty(5);

    var filtered = property.filter(function(x){
      return x % 2 === 0;
    })

    expect(filtered instanceof Kefir.Property).toBe(true);
    expect(filtered.hasCached()).toBe(false);

    helpers.captureOutput(filtered, function(values){
      expect(values).toEqual([2, 4]);
      done();
    });

  }, 100);



});

},{"../../dist/kefir.js":1,"../test-helpers":21}],5:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".flatMap()", function(){

  it("works", function(done){

    var main = new Kefir.Bus;
    var mapped = main.flatMap(function(x){
      return x;
    });

    var childA = new Kefir.Bus;
    var childB = new Kefir.Bus;

    helpers.captureOutput(mapped, function(values){
      expect(values).toEqual([1, 2, 3, 4]);
      done();
    });

    main.push(childA)
    childA.push(1)
    main.push(childB)
    childB.push(2)
    childA.push(3)
    childB.push(4)
    main.end()

  }, 100);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],6:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Kefir.fromPoll()", function(){

  it("works", function(done){

    function pollArray(values, interval){
      return Kefir.fromPoll(interval, function(){
        if (values.length > 0) {
          return values.shift();
        } else {
          return Kefir.END;
        }
      })
    }

    var stream1 = helpers.sampleStream([1, Kefir.END]);
    var stream2 = pollArray([2, 4], 30);
    var stream3 = pollArray([3, 5], 45);

    // -1----------
    // ---2---4----
    // -----3-----5
    var merged = stream1.merge(stream2, stream3);

    helpers.captureOutput(merged, function(values){
      expect(values).toEqual([1, 2, 3, 4, 5]);
      done();
    });

  }, 200);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],7:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');


describe("Kefir.fromBinder()", function(){



  it("subscribe/unsubscibe", function() {

    var log = [];
    var obs = Kefir.fromBinder(function(send){
      log.push('in');
      return function(){
        log.push('out');
      }
    });

    var subscriber1 = function(){}
    var subscriber2 = function(){}

    expect(log).toEqual([]);

    obs.onValue(subscriber1);
    expect(log).toEqual(['in']);

    obs.onValue(subscriber2);
    expect(log).toEqual(['in']);

    obs.offValue(subscriber1);
    expect(log).toEqual(['in']);

    obs.offValue(subscriber2);
    expect(log).toEqual(['in', 'out']);

    obs.onValue(subscriber1);
    expect(log).toEqual(['in', 'out', 'in']);

    obs.offValue(subscriber1);
    expect(log).toEqual(['in', 'out', 'in', 'out']);

  });



  it("send", function(done) {

    var __send;

    var obs = Kefir.fromBinder(function(send){
      __send = send;
      return function(){};
    });

    helpers.captureOutput(obs, function(values){
      expect(values).toEqual([1, 2, 3, 4]);
      done();
    });

    __send(1);
    __send(2);
    __send(Kefir.NOTHING);
    __send(Kefir.bunch(3, Kefir.NOTHING, 4, Kefir.END));

  }, 1);




});

},{"../../dist/kefir.js":1,"../test-helpers":21}],8:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Kefir.interval()", function(){

  it("works", function(done){

    var stream1 = helpers.sampleStream([1, Kefir.END]);
    var stream2 = Kefir.interval(30, 2).take(2);
    var stream3 = Kefir.interval(45, 3).take(2);

    // -1----------
    // ---2---2----
    // -----3-----3
    var merged = stream1.merge(stream2, stream3);

    helpers.captureOutput(merged, function(values){
      expect(values).toEqual([1, 2, 3, 2, 3]);
      done();
    });

  }, 200);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],9:[function(require,module,exports){
// var Kefir = require('../../dist/kefir.js');
// var helpers = require('../test-helpers');


// if (typeof window !== 'undefined'){

//   describe("jQuery::eventStream()", function(){


//     it("jquery itself works", function(){

//       var count = 0;
//       function handler(){ count++ }

//       jQuery('body').on('click', handler);
//       jQuery('body').trigger('click');
//       jQuery('body').off('click', handler);

//       expect(count).toBe(1);

//     });



//     it("just event name", function(done){

//       var stream = jQuery('body').eventStream('click').take(2);

//       helpers.captureOutput(stream, function(values){
//         expect(values.length).toBe(2);
//         done();
//       });

//       jQuery('body').trigger('click');
//       jQuery('body').trigger('click');
//       jQuery('body').trigger('click');

//     });


//     it("event name and selector", function(done){

//       var stream = jQuery('body').eventStream('click', '.my-button').take(2);

//       helpers.captureOutput(stream, function(values){
//         expect(values.length).toBe(2);
//         done();
//       });

//       $btn = jQuery('<button class="my-button">my-button</button>').appendTo('body');

//       $btn.trigger('click');
//       $btn.trigger('click');
//       $btn.trigger('click');

//       $btn.remove()

//     });


//     it("event name, selector, and transformer", function(done){

//       var stream = jQuery('body')
//         .eventStream('click', '.my-button', function(event){
//           return this === event.currentTarget && jQuery(this).hasClass('my-button');
//         }).take(2);

//       helpers.captureOutput(stream, function(values){
//         expect(values).toEqual([true, true]);
//         done();
//       });

//       $btn = jQuery('<button class="my-button">my-button</button>').appendTo('body');

//       $btn.trigger('click');
//       $btn.trigger('click');
//       $btn.trigger('click');

//       $btn.remove()

//     });


//   });

// }

},{}],10:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".map()", function(){

  it("works", function(done){

    var stream = helpers.sampleStream([1, 2, Kefir.END]);
    var mapped = stream.map(function(x){
      return x*2;
    })

    helpers.captureOutput(mapped, function(values){
      expect(values).toEqual([2, 4]);
      done();
    });

  }, 100);


  it("produce Property from Property", function(done){

    var property = helpers.sampleStream([1, 2, Kefir.END]).toProperty(5);

    var mapped = property.map(function(x){
      return x*2;
    })

    expect(mapped instanceof Kefir.Property).toBe(true);
    expect(mapped.getCached()).toBe(10);

    helpers.captureOutput(mapped, function(values){
      expect(values).toEqual([10, 2, 4]);
      done();
    });

  }, 100);



  it("with temporary all unsubscribed", function(done){

    var bus = new Kefir.Bus;
    var mapped = bus.map(function(x){
      return x*2;
    })

    helpers.captureOutput(mapped.take(2), function(values){
      expect(values).toEqual([2, 4]);
    });

    bus.push(1)
    bus.push(2)
    expect(bus.__hasSubscribers('value')).toBe(true);
    bus.push(3)
    expect(bus.__hasSubscribers('value')).toBe(false);

    helpers.captureOutput(mapped, function(values){
      expect(values).toEqual([8, 10]);
      done();
    });

    bus.push(4)
    bus.push(5)
    bus.end()

  }, 100);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],11:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".merge()", function(){


  it("works", function(done){

    var stream1 = helpers.sampleStream([1, Kefir.END]);
    var stream2 = helpers.sampleStream([2, 4, Kefir.END], 30);
    var stream3 = helpers.sampleStream([3, 5, Kefir.END], 45);

    // -1----------
    // ---2---4----
    // -----3-----5
    var merged = stream1.merge(stream2, stream3);

    helpers.captureOutput(merged, function(values){
      expect(values).toEqual([1, 2, 3, 4, 5]);
      done();
    });

  }, 200);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],12:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Kefir.never()", function(){

  it("works", function(done){

    helpers.captureOutput(Kefir.never(), function(values){
      expect(values).toEqual([]);
      done();
    });

  }, 100);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],13:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("No more", function(){

  it("works", function(){

    var bus = new Kefir.Bus;

    var values = []
    bus.onValue(function(x){
      values.push(x);
      if (x > 2) {
        return Kefir.NO_MORE;
      }
    });

    bus.push(1);
    bus.push(2);
    bus.push(3);
    bus.push(4);
    bus.push(5);

    expect(values).toEqual([1, 2, 3]);

  });


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],14:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');


describe("Observable/Stream", function(){

  it("onFirstIn/onLastOut", function(){

    var log = [];
    var obs = new Kefir.Observable(
      function(){ log.push('in') },
      function(){ log.push('out') }
    )

    var subscriber1 = function(){}
    var subscriber2 = function(){}

    expect(log).toEqual([]);

    obs.onValue(subscriber1);
    expect(log).toEqual(['in']);

    obs.onValue(subscriber2);
    expect(log).toEqual(['in']);

    obs.offValue(subscriber1);
    expect(log).toEqual(['in']);

    obs.offValue(subscriber2);
    expect(log).toEqual(['in', 'out']);

    obs.onValue(subscriber1);
    expect(log).toEqual(['in', 'out', 'in']);

    obs.offValue(subscriber1);
    expect(log).toEqual(['in', 'out', 'in', 'out']);

  });



  it("onValue/offValue", function(){

    var log = [];
    var obs = new Kefir.Observable();

    var subscriber = function(x){  log.push(x)  }

    obs.__sendValue(1);
    expect(log).toEqual([]);

    obs.onValue(subscriber);
    expect(log).toEqual([]);

    obs.__sendValue(2);
    expect(log).toEqual([2]);

    obs.__sendValue(3);
    expect(log).toEqual([2, 3]);

    obs.offValue(subscriber);
    obs.__sendValue(4);
    expect(log).toEqual([2, 3]);

    obs.onValue(subscriber);
    expect(log).toEqual([2, 3]);

    obs.__sendValue(5);
    expect(log).toEqual([2, 3, 5]);


  });


  it("onEnd/offEnd, isEnded", function(){

    var callCount = 0;
    var obs = new Kefir.Observable();

    var subscriber1 = function(x){  callCount++;  }
    var subscriber2 = function(x){  callCount++;  }

    obs.onEnd(subscriber1);
    obs.onEnd(subscriber2);

    expect(callCount).toBe(0);
    expect(obs.isEnded()).toBe(false);

    obs.offEnd(subscriber2);

    obs.__sendEnd();
    expect(callCount).toBe(1);
    expect(obs.isEnded()).toBe(true);

    obs.onEnd(subscriber2);
    expect(callCount).toBe(2);

  });



  it("subscribers with context and args", function(){

    var log = [];
    var obs = new Kefir.Observable();

    var subscriber = function(){
      log.push( [this].concat([].slice.call(arguments)) );
    }

    obs.onValue(subscriber, "foo", 1, 2);
    obs.onValue(subscriber, "bar", 3, 4);
    obs.onEnd(subscriber, "end", 5, 6);

    obs.__sendValue(1);
    expect(log).toEqual([
      ["foo", 1, 2, 1],
      ["bar", 3, 4, 1]
    ]);

    obs.offValue(subscriber, "bar", 3, 4);

    obs.__sendValue(2);
    expect(log).toEqual([
      ["foo", 1, 2, 1],
      ["bar", 3, 4, 1],
      ["foo", 1, 2, 2]
    ]);

    obs.__sendEnd()
    expect(log).toEqual([
      ["foo", 1, 2, 1],
      ["bar", 3, 4, 1],
      ["foo", 1, 2, 2],
      ["end", 5, 6]
    ]);

  });


  it("send after end", function(){

    var log = [];
    var obs = new Kefir.Observable();

    var subscriber = function(x){  log.push(x)  }

    obs.onValue(subscriber);
    expect(log).toEqual([]);

    obs.__sendEnd();
    obs.__sendValue(1);
    expect(log).toEqual([]);

  });


  it("_sendAny", function(done){

    var obs = new Kefir.Observable();

    helpers.captureOutput(obs, function(values){
      expect(values).toEqual([1, 2, 3, 4]);
      done();
    });

    obs.__sendValue(1);
    obs.__sendAny(2);
    obs.__sendAny(Kefir.NOTHING);
    obs.__sendAny(Kefir.bunch(3, Kefir.NOTHING, 4, Kefir.END));

  }, 1);



});

},{"../../dist/kefir.js":1,"../test-helpers":21}],15:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Kefir.once()", function(){

  it("works", function(done){

    var stream = Kefir.once(1);

    helpers.captureOutput(stream, function(values){
      expect(values).toEqual([1]);
    });

    helpers.captureOutput(stream, function(values){
      expect(values).toEqual([]);
      done();
    });

  }, 100);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],16:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Property", function(){

  it("hasCached, getCached", function(){

    var prop = new Kefir.Property();

    expect(prop.hasCached()).toBe(false);
    expect(prop.getCached()).toBe(Kefir.NOTHING);

    prop.__sendValue(1)
    expect(prop.hasCached()).toBe(true);
    expect(prop.getCached()).toBe(1);

    prop = new Kefir.Property(null, null, 2);

    expect(prop.hasCached()).toBe(true);
    expect(prop.getCached()).toBe(2);

  });


  it("onValue", function(done){

    var prop = new Kefir.Property(null, null, 'foo');

    prop.onValue(function(x){
      expect(x).toBe('foo');
      done();
    })

  }, 1);


  it("onNewValue", function(){

    var log = [];
    var prop = new Kefir.Property(null, null, 'foo');

    prop.onNewValue(function(x){
      log.push(x);
    });

    prop.__sendValue(1);
    prop.__sendValue(2);

    expect(log).toEqual([1, 2]);

  });


  it("stream.toProperty()", function(){

    var stream = new Kefir.Stream();
    var prop = stream.toProperty();

    var log = [];
    prop.onValue(function(x){
      log.push(x);
    })

    expect(prop.hasCached()).toBe(false);
    expect(prop.getCached()).toBe(Kefir.NOTHING);
    expect(log).toEqual([]);

    stream.__sendValue(1);

    expect(prop.hasCached()).toBe(true);
    expect(prop.getCached()).toBe(1);
    expect(log).toEqual([1]);

    stream.__sendValue(2);

    expect(prop.hasCached()).toBe(true);
    expect(prop.getCached()).toBe(2);
    expect(log).toEqual([1, 2]);

    stream.__sendEnd();

    expect(prop.isEnded()).toBe(true);
    expect(prop.hasCached()).toBe(true);
    expect(prop.getCached()).toBe(2);


    // with initial

    var prop2 = stream.toProperty(5);

    expect(prop2.hasCached()).toBe(true);
    expect(prop2.getCached()).toBe(5);

  });



  it("property.toProperty()", function(){

    var prop = new Kefir.Property(null, null, 'foo');

    expect(prop.toProperty()).toBe(prop);


    // with initial

    var prop2 = prop.toProperty(5);

    expect(prop2.hasCached()).toBe(true);
    expect(prop2.getCached()).toBe(5);

  });



});

},{"../../dist/kefir.js":1,"../test-helpers":21}],17:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Kefir.repeatedly()", function(){

  it("works", function(done){

    var stream1 = helpers.sampleStream([1, Kefir.END]);
    var stream2 = Kefir.repeatedly(30, [2, 4]).take(5);
    var stream3 = Kefir.repeatedly(45, [3, 5]).take(1);

    // 1
    // ---2---4---2---4---2
    // -----3
    var merged = stream1.merge(stream2, stream3);

    helpers.captureOutput(merged, function(values){
      expect(values).toEqual([1, 2, 3, 4, 2, 4, 2]);
      done();
    });

  }, 200);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],18:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe("Kefir.sequentially()", function(){

  it("works", function(done){

    var stream1 = helpers.sampleStream([1, Kefir.END]);
    var stream2 = Kefir.sequentially(30, [2, 4]);
    var stream3 = Kefir.sequentially(45, [3, 5]);

    // -1----------
    // ---2---4----
    // -----3-----5
    var merged = stream1.merge(stream2, stream3);

    helpers.captureOutput(merged, function(values){
      expect(values).toEqual([1, 2, 3, 4, 5]);
      done();
    });

  }, 200);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],19:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".takeWhile()", function(){

  it("works", function(done){

    var stream = helpers.sampleStream([1, 2, 3, 4, Kefir.END]);
    var filtered = stream.takeWhile(function(x){
      return x !== 3;
    })

    helpers.captureOutput(filtered, function(values){
      expect(values).toEqual([1, 2]);
      done();
    });

  }, 100);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],20:[function(require,module,exports){
var Kefir = require('../../dist/kefir.js');
var helpers = require('../test-helpers');



describe(".take()", function(){

  it("works", function(done){

    var stream = helpers.sampleStream([1, 2, 3, 4, Kefir.END]);

    var first2 = stream.take(2);
    var first10 = stream.take(10);

    helpers.captureOutput(first2, function(values){
      expect(values).toEqual([1, 2]);
    });

    helpers.captureOutput(first10, function(values){
      expect(values).toEqual([1, 2, 3, 4]);
      done();
    });

  }, 100);


});

},{"../../dist/kefir.js":1,"../test-helpers":21}],21:[function(require,module,exports){
var Kefir = require('../dist/kefir.js');

exports.captureOutput = function(stream, callback) {
  var values = [];

  function log(value){
    values.push(value);
  }

  function report(){
    callback(values);
  }

  stream.onValue(log);
  stream.onEnd(report);
}



exports.sampleStream = function(values, interval){
  interval = interval || 0;

  var intervalId = null;

  var stream = new Kefir.Stream(
    function(){
      intervalId = setInterval(function(){
        if (values.length > 0) {
          stream.__sendAny( values.shift() );
        }
      }, interval)
    },
    function(){
      clearInterval(intervalId);
      intervalId = null;
    }
  );

  return stream;
}

},{"../dist/kefir.js":1}]},{},[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20])