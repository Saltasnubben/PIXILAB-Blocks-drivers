interface WebsocketConnection {
	sendText(text: string): void;
	disconnect(): void;
	subscribe(event: string, listener: (sender: any, message: any) => void): void;
	unsubscribe(event: string, listener: Function): void;
}

declare module "system/SimpleWebsocket" {
	export class SimpleWebsocket {
		static connect(url: string, maxMsgSize?: number, headers?: { [key: string]: string }): Promise<WebsocketConnection>;
	}
}
