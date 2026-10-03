import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductJsonLd } from "./json-ld";

describe("Product structured data", () => {
	it("renders an absolute default image with the usage offer", () => {
		const { container } = render(
			<ProductJsonLd name="OMA API" description="Inference" price="0.01" />,
		);
		const script = container.querySelector('script[type="application/ld+json"]')!;
		expect(JSON.parse(script.textContent!)).toMatchObject({
			"@type": "Product",
			image: "https://www.oma-ai.com/og-image.png",
			offers: { "@type": "Offer", price: "0.01", priceCurrency: "USD" },
		});
	});

	it("keeps a supplied product image in the emitted schema", () => {
		const { container } = render(
			<ProductJsonLd name="OMA API" description="Inference" price="0.01" image="https://www.oma-ai.com/logos/oma-icon-512.png" />,
		);
		const script = container.querySelector('script[type="application/ld+json"]')!;
		expect(JSON.parse(script.textContent!).image).toBe("https://www.oma-ai.com/logos/oma-icon-512.png");
	});

	it("escapes markup in product text without changing the JSON value", () => {
		const name = "</script><script>alert(1)</script>";
		const { container } = render(
			<ProductJsonLd name={name} description="Inference" price="0.01" />,
		);
		const scripts = container.querySelectorAll('script[type="application/ld+json"]');
		expect(scripts).toHaveLength(1);
		expect(scripts[0].textContent).not.toContain("<");
		expect(JSON.parse(scripts[0].textContent!).name).toBe(name);
	});
});
