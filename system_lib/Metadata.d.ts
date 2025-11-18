declare module "system_lib/Metadata" {
	export function driver(type: string, options?: any): ClassDecorator;
	export function property(description: string): PropertyDecorator;
	export function callable(description: string): MethodDecorator;
	export function parameter(description: string, optional?: boolean): ParameterDecorator;
	export function min(value: number): PropertyDecorator;
	export function max(value: number): PropertyDecorator;
}
