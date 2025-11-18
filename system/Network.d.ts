declare module "system/Network" {
	export class NetworkTCP {
		connected: boolean;
		autoConnect(): void;
		subscribe(event: string, callback: (sender: any, message: any) => void): void;
		sendText(text: string): any;
	}
	export class NetworkUDP {
		connected: boolean;
		subscribe(event: string, callback: (sender: any, message: any) => void): void;
		sendText(text: string): any;
	}
}
