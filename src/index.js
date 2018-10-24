import { queueMixin } from './lib/queue'

function Queue(max, options) {
   this._init(max, options)
}

queueMixin(Queue)

Queue.version = '1.0.2'

export default Queue