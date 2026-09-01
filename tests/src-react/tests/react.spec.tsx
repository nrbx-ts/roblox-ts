/// <reference types="@rbxts/testez/globals" />
import React from "@rbxts/react";

export = () => {
	describe("React JSX", () => {
		it("should create intrinsic elements from JSX", () => {
			const element = <frame />;
			const manual = React.createElement("frame");

			// JSX and createElement should resolve the intrinsic tag the same way
			expect(element.type).to.equal(manual.type);
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
			expect(fragment.type).to.equal(React.Fragment);
		});

		it("should create fragments via React.Fragment", () => {
			const element = <React.Fragment />;
			expect(element.type).to.equal(React.Fragment);
		});

		it("should keep the React import referenced by both JSX and direct usage", () => {
			const jsxElement = <frame />;
			const directElement = React.createElement("Frame");
			const fragment = (
				<>
					<textlabel Text="a" />
					<textlabel Text="b" />
				</>
			);

			expect(jsxElement.type).to.be.a("string");
			expect(directElement.type).to.be.a("string");
			expect(fragment.type).to.equal(React.Fragment);
		});
	});
};
