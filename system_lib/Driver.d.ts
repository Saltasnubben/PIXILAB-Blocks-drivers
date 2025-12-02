interface NetworkTCP {
	connected: boolean;
	autoConnect(): void;
	subscribe(event: string, callback: (sender: any, message: any) => void): void;
	sendText(text: string, eol?: string): any;
}

declare module "system_lib/Driver" {
	export class Driver<T> {
		protected socket: T;
		constructor(socket: T);
		protected onConnectStateChanged(connected: boolean): void;
	}
}
