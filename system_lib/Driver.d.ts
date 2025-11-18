declare module "system_lib/Driver" {
	export class Driver<T> {
		protected socket: T;
		constructor(socket: T);
		protected onConnectStateChanged(connected: boolean): void;
	}
}
