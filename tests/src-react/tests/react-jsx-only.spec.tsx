/// <reference types="@rbxts/testez/globals" />
import React from "@rbxts/react";

export = () => {
	describe("React JSX (import only referenced by JSX)", () => {
		it("should create intrinsic elements from JSX", () => {
			const element = <frame />;
			expect(element.type).to.be.a("string");
		});

		it("should preserve props on elements", () => {
			const TEXT = "Hello, World!";
			const element = <textlabel Text={TEXT} />;
			expect((element.props as { Text: string }).Text).to.equal(TEXT);
		});

		it("should create elements from function components", () => {
			function MyComponent(props: { text: string }) {
				return <textlabel Text={props.text} />;
			}

			const element = <MyComponent text="hi" />;
			expect(element.type).to.equal(MyComponent);
			expect((element.props as { text: string }).text).to.equal("hi");
		});

		it("should create fragments from JSX fragments", () => {
			const fragment = (
				<>
					<frame />
					<textlabel />
				</>
			);
			const emptyFragment = <></>;
			expect(fragment.type).to.equal(emptyFragment.type);
		});

		it("should create fragments via React.Fragment", () => {
			const element = <React.Fragment />;
			const fragment = <></>;
			expect(element.type).to.equal(fragment.type);
		});
	});
};
