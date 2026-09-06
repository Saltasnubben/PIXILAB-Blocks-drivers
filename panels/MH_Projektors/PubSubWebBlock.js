export default class PubSubWebBlock {
    constructor() {
        this.subscribers = {};
        window.addEventListener("message", (event) => {
            if (event.data.type === "pubsub-data")
                this.gotData(event.data.path, event.data.value);
        }, false);
    }
    set(path, value) {
        window.parent.postMessage({ type: 'pubsub-set', path: path, value: value }, '*');
    }
    add(path, value) {
        window.parent.postMessage({ type: 'pubsub-add', path: path, value: value }, '*');
    }
    subscribe(path, dataCallback, synchronousCallback) {
        let subscription = this.subscribers[path];
        if (!subscription) {
            window.parent.postMessage({ type: 'pubsub-subscribe', path: path }, '*');
            subscription = new Subscription();
            this.subscribers[path] = subscription;
        }
        subscription.handlers.add(dataCallback);
        const knownValue = subscription.lastValue;
        if (knownValue !== undefined && synchronousCallback)
            dataCallback.dataReceived(path, knownValue);
        return knownValue;
    }
    unsubscribe(path, dataCallback) {
        let subscription = this.subscribers[path];
        if (subscription) {
            if (subscription.handlers.delete(dataCallback)) {
                if (subscription.handlers.size === 0) {
                    window.parent.postMessage({ type: 'pubsub-unsubscribe', path: path }, '*');
                    delete this.subscribers[path];
                }
            } else {
                console.warn("pub-sub-iframe no handler for", path, dataCallback);
            }
        } else {
            console.warn("pub-sub-iframe not subscribed to", path);
        }
    }
    gotData(path, value) {
        let subscription = this.subscribers[path];
        if (subscription)
            subscription.update(path, value);
        else
            console.warn("pub-sub-iframe spurious data on path", path, value);
    }
}

class Subscription {
    constructor() {
        this.handlers = new Set();
    }
    update(path, value) {
        this.lastValue = value;
        this.handlers.forEach(handler => handler.dataReceived(value, path));
    }
}
