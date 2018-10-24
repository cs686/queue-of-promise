var epc = require("extend-promise/src/extendClass");

export function isArray (obj) {
	return Object.prototype.toString.call(obj) == "[object Array]";
}

export function isFunction (obj) {
	return typeof obj === "function";
}

export function isObject (obj) {
	return typeof obj === "object" && obj !== null
}

export function arg2arr (arg, b, s) {
	return Array.prototype.slice.call(arg, b, s);
}

export function toArray () {
	return Array.prototype.concat.apply([], arguments);
}

/**
 * 将值修整为正整数，0与负数报错
 * @param {Number} max 
 */
export function getPositiveInt (max) {
	var _max = (+max) >> 0;
	if (_max >= 1) {
		return _max;
	} else {
		throw new Error('The "max" value is invalid')
	}
}
/**
 * 扩展Promise
 * @param {Promise} Promise 
 */
export function extendPromise (Promise) {
	return epc(Promise, {});
}

export function runFn2Promise(Promise,fn) {
	try{
		return Promise.resolve(fn());
	}catch(e){
		return Promise.reject(e);
	}
}