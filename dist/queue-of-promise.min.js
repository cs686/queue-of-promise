/*!
 * queue-of-promise v1.0.0
 * (c) 2018-2018 cs686
 * Released under the MIT License.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.queueOfPromise = factory());
}(this, (function () { 'use strict';

  var utils = require("./utils.js");

  var Promise = require("bluebird");

  function queueMixin(Queue) {
    var DEFAULT_OPTIONS = {
      queueStart: null,
      //队列开始
      queueEnd: null,
      //队列完成
      workAdd: null,
      //有执行项添加进执行单元后执行
      workResolve: null,
      //成功
      workReject: null,
      //失败
      workFinally: null,
      //一个执行单元结束后
      retry: 0,
      //执行单元出错重试次数
      retryIsJump: false,
      //重试模式 false:搁置执行(插入队列尾部重试),true:优先执行 (插入队列头部重试)
      timeout: 0 //执行单元超时时间(毫秒)

    };

    var _Promise;

    _Promise = Queue.Q = Queue.Promise = utils.extendPromise(Promise);

    var runFn = function runFn(fn) {
      return utils.runFn2Promise(_Promise, fn);
    };

    var ONERROR = function ONERROR(err) {
      console.error(err);
    };

    Queue.prototype._init = function (max, options) {
      var self = this;
      var _isStart = false;
      var _isStop = 0;
      var _runCount = 0;
      var _queue = [];
      var _max = max;
      this._options = DEFAULT_OPTIONS;
      this.onError = ONERROR;

      if (utils.isObject(options)) {
        for (var i in options) {
          if (DEFAULT_OPTIONS.hasOwnProperty(i)) {
            DEFAULT_OPTIONS[i] = options[i];
          }
        }
      }

      this.getLength = function () {
        return _queue.length;
      }; //正在运行的项数


      this.getRunCount = function () {
        return _runCount;
      };

      this.isStart = function () {
        return !!_isStart;
      };
      /**
       * 向队列插入执行单元
       * @param {queueUnit} unit 执行单元对像
       * @param {bool} stack  是否以栈模式(后进先出)插入
       * @param {bool} start  是否启动队列
       * @param {bool} noAdd  是否调用队列workAdd方法 (重试模式不调用需要)
       */


      this._addItem = function (unit, stack, start, noAdd) {
        if (!(unit instanceof QueueUnit)) throw new TypeError('"unit" is not QueueUnit');

        if (stack) {
          _queue.unshift(unit);
        } else {
          _queue.push(unit);
        }

        noAdd || runAddEvent.call(self, unit);

        if (start) {
          self.start();
        } else {
          _isStart && queueRun();
        }
      }; //执行下一项


      function next() {
        if (_runCount < _max && !_isStop && _queue.length > 0) {
          var unit = _queue.shift(); //if(unit){


          var xc_timeout,
              _mark = 0;
          var timeout = +getOption("timeout", unit, self),
              retryNo = getOption("retry", unit, self),
              retryType = getOption("retryIsJump", unit, self),
              _self = unit._options.self;

          var fix = function fix() {
            if (xc_timeout) clearTimeout(xc_timeout);
            xc_timeout = 0;
            if (_mark++) return true;
            _runCount--;
          };

          var afinally = function afinally() {
            autoRun(unit, self, "workFinally", self, self, unit); // if(runEvent.call(unit,'workFinally',self,self,unit) !== false){
            // 	onoff && runEvent.call(self,'workFinally',self,self,unit);
            // }
          };

          var issucc = function issucc(data) {
            if (fix()) return;
            unit.defer.resolve(data); //通知执行单元,成功

            autoRun(unit, self, "workResolve", self, data, self, unit); // if(runEvent.call(unit,'workResolve',self,data,self,unit) !== false){
            // 	onoff && runEvent.call(self,'workResolve',self,data,self,unit);
            // }

            afinally();
          };

          var iserr = function iserr(err) {
            if (fix()) return;

            if (retryNo > unit._errNo++) {
              self._addItem(unit, retryType, true, false);
            } else {
              unit.defer.reject(err); //通知执行单元,失败

              autoRun(unit, self, "workReject", self, err, self, unit); // if(runEvent.call(unit,'workReject',self,err,self,unit) !== false){
              // 	onoff && runEvent.call(self,'workReject',self,err,self,unit);
              // }
            }

            afinally();
          }; //队列开始执行事件


          if (_runCount == 0 && !_isStart) {
            _isStart = true;
            runEvent.call(self, "queueStart", self, self);
          }

          var nextp = runFn(function () {
            return unit.fn.apply(_self || null, unit.regs);
          }).then(issucc, iserr).then(function () {
            if (_queue.length > 0) {
              queueRun();
            } else if (_runCount == 0 && _isStart) {
              //队列结束执行事件
              _isStart = false;
              runEvent.call(self, "queueEnd", self, self);
            }
          });
          _runCount += 1; //nextp.then(defer.resolve,defer.reject)

          if (timeout > 0) {
            xc_timeout = setTimeout(function () {
              iserr("timeout");
            }, timeout);
          } //return;
          //}


          return;
        }

        return true;
      }

      function queueRun() {
        while (!next()) {} // if(_isStop) return;
        // do{
        // 	next();
        // }while(_queue.length && _runCount < _max)

      }
      /**队列控制**/
      //开始执行队列


      this.start = function () {
        _isStop = 0;
        queueRun();
      };

      this.stop = function () {
        //console.log('on stop')
        _isStop = 1;
      }; //清空执行队列


      this.clear = function (err) {
        while (_queue.length) {
          var unit = _queue.shift();

          unit.defer.reject(err);
        }
      };
    };
    /**
     * 队列执行单元类
     * @param {Function} fn  运行函数
     * @param {Array}    args 运行函数的参数,可省略
     * @param {Object}   options 其他配置
     */


    function QueueUnit(fn, args, options) {
      var def = {
        workResolve: true,
        workReject: true,
        workFinally: true,
        queueEventTrigger: true,
        regs: [],
        self: null
      };
      var oNames = ["workResolve", //是否执行队列workResolve事件
      "workReject", //是否执行队列workReject事件
      "workFinally", //是否执行队列workFinally事件
      "queueEventTrigger", //队列事件开关
      "retry", //重试次数
      "retryIsJump", //重试模式
      "timeout", //超时
      "self" //运行函数self
      ];
      var oi = 1;

      if (!utils.isFunction(fn)) {
        throw new TypeError("Queues only support function, '" + fn + "' is not function");
      }

      this.fn = fn;
      this._errNo = 0; // function defer() {
      //   var deferred = {};
      //   var promise = new _Promise(function(resolve, reject) {
      //     deferred.resolve = resolve;
      //     deferred.reject = reject;
      //   });
      //   deferred.promise = promise;
      //   return deferred;
      // }

      this.defer = _Promise.defer();

      if (utils.isArray(args)) {
        this.regs = args;
        oi++;
      }

      function inOptions(name) {
        for (var i = 0; i < oNames.length; i++) {
          if (name === oNames[i]) return true;
        }

        return false;
      }

      this._options = def;
      var configObj = arguments[oi]; //console.log(configObj);

      if (utils.isObject(configObj)) {
        for (var i in configObj) {
          if (inOptions(i)) {
            def[i] = configObj[i];
          }
        }
      }
    }

    function getOption(name, qobj, queue) {
      if (name in qobj._options) {
        return qobj._options[name];
      } else {
        return queue._options[name];
      }
    }

    function runEvent(eventName, self) {
      var event = this._options[eventName],
          arg = utils.arg2arr(arguments, 2);

      if (utils.isFunction(event)) {
        try {
          return event.apply(self, arg);
        } catch (e) {
          onError.call(self, e);
        }
      } else {
        return !!event;
      }
    }

    function autoRun(unit, queue) {
      var onoff = unit._options.queueEventTrigger;
      var args = utils.arg2arr(arguments, 2);

      if (runEvent.apply(unit, args) !== false) {
        onoff && runEvent.apply(queue, args);
      }
    }

    function runAddEvent(unit) {
      runEvent.call(this, "workAdd", this, unit, this);
    } //构建执行单元对象


    function getQueueUnit(fn, args, options) {
      // try{
      return new QueueUnit(fn, args, options); // }catch(e){
      // 	if(utils.isFunction(this.onError)){
      // 		this.onError(e)
      // 	}
      // }
    }

    function onError(err) {
      if (utils.isFunction(this.onError)) {
        this.onError.call(this, err);
      }
    }

    function getAddArgs(data, fn, con, each) {
      var isArray = utils.isArray(data);
      var rdata = isArray ? [] : {};

      function fill(k) {
        var args = each ? utils.toArray([data[k]], [k], [data]) : utils.toArray(data[k]);
        rdata[k] = [fn, args, con];
      }

      if (isArray) {
        for (var i = 0; i < data.length; i++) {
          fill(i);
        }
      } else {
        for (var k in data) {
          fill(k);
        }
      }

      return rdata;
    }

    function getBatchArgs(array, fn, con) {
      var baseN = 2,
          _con;

      if (utils.isObject(con)) {
        _con = con;
        baseN++;
      }

      return {
        con: _con,
        start: arguments[baseN],
        jump: arguments[++baseN]
      };
    }

    function AddBatch(data, fn) {
      var queue = this.queue,
          map = this.map,
          each = this.each;
      var addArgs;
      var args = getBatchArgs.apply(null, arguments);
      addArgs = getAddArgs(data, fn, args.con, each);

      if (map) {
        return queue.addProps(addArgs, args.start, args.jump);
      } else {
        return queue.addArray(addArgs, args.start, args.jump);
      }
    }
    /**
     *
     *
     * @param {*} name
     * @returns
     */


    Queue.prototype.option = function (name) {
      if (arguments.length == 1) {
        return this._options[name];
      } else if (arguments.length > 1) {
        this._options[name] = arguments[1];
      }
    };

    Queue.prototype.push = function () {
      var o = this,
          unit = getQueueUnit.apply(o, arguments);

      o._addItem(unit, false);

      return unit.defer.promise;
    };

    Queue.prototype.unshift = function () {
      var o = this,
          unit = getQueueUnit.apply(o, arguments);

      o._addItem(unit, true);

      return unit.defer.promise;
    };

    Queue.prototype.go = function () {
      var o = this,
          unit = getQueueUnit.apply(o, arguments);

      o._addItem(unit, false, true);

      return unit.defer.promise;
    };

    Queue.prototype.jump = function () {
      var o = this,
          unit = getQueueUnit.apply(o, arguments);

      o._addItem(unit, true, true);

      return unit.defer.promise;
    };

    Queue.prototype.add = function (fn, options) {
      //fn,*options*,*start*,*jump*
      var o = this,
          _fun,
          _i = 1,
          unitArgs,
          start,
          jump,
          promise;

      if (!utils.isFunction(fn)) throw new TypeError("Queues only support function, '" + fn + "' is not function");

      _fun = function _fun() {
        var defer = _Promise.defer();

        fn(defer.resolve, defer.reject);
        return defer.promise;
      };

      unitArgs = [_fun];

      if (utils.isObject(options)) {
        unitArgs.push(options);
        _i++;
      }

      start = !!arguments[_i];
      jump = !!arguments[_i + 1];
      promise = jump ? o.unshift.apply(o, unitArgs) : o.push.apply(o, unitArgs);
      if (start) o.start();
      return promise;
    };

    Queue.prototype.addArray = function (array, start, jump) {
      var parrs = [];
      var o = this;

      for (var i = 0; i < array.length; i++) {
        +function () {
          var _i = i;
          var unitArgs = utils.toArray(array[_i]);

          var _p = jump ? o.unshift.apply(o, unitArgs) : o.push.apply(o, unitArgs);

          parrs.push(_p);
        }();
      }

      var nextP = _Promise.defer();

      _Promise.all(parrs).then(function (data) {
        nextP.resolve(data);
      }, function (err) {
        nextP.reject(err);
      });

      if (start) o.start();
      return nextP.promise;
    };

    Queue.prototype.addProps = function (props, start, jump) {
      var parrs = {};
      var o = this;

      for (var k in props) {
        +function () {
          var _k = k;
          var unitArgs = utils.toArray(props[_k]);

          var _p = jump ? o.unshift.apply(o, unitArgs) : o.push.apply(o, unitArgs);

          parrs[_k] = _p;
        }();
      } // function defer() {
      //   var deferred = {};
      //   var promise = new _Promise(function(resolve, reject) {
      //     deferred.resolve = resolve;
      //     deferred.reject = reject;
      //   });
      //   deferred.promise = promise;
      //   return deferred;
      // }


      var nextP = _Promise.defer();

      _Promise.allMap(parrs).then(function (data) {
        nextP.resolve(data);
      }, function (err) {
        nextP.reject(err);
      });

      if (start) o.start();
      return nextP.promise;
    };

    Queue.prototype.addLikeArray = function (array, fn, con) {
      return AddBatch.apply({
        queue: this
      }, arguments);
    };

    Queue.prototype.addLikeProps = function (props, fn, con) {
      return AddBatch.apply({
        queue: this,
        map: true
      }, arguments);
    };

    Queue.prototype.addLikeArrayEach = function (array, fn, con) {
      return AddBatch.apply({
        queue: this,
        each: true
      }, arguments);
    };

    Queue.prototype.addLikePropsEach = function (array, fn, con) {
      return AddBatch.apply({
        queue: this,
        each: true,
        map: true
      }, arguments);
    };
  }

  function Queue(max, options) {
    this._init(max, options);
  }

  queueMixin(Queue);
  Queue.version = '1.0.0';

  return Queue;

})));
