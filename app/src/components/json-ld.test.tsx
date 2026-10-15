import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceJsonLd, SoftwareApplicationJsonLd } from "./json-ld";

it("does not publish the paid API as a zero-dollar software offer", () => {
	const { container } = render(<SoftwareApplicationJsonLd />);
	const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
	expect(data.offers).toBeUndefined();
});

describe("Inference service structured data", () => {
	it("describes metered inference without inventing a flat-price offer", () => {
		const { container } = render(
			<ServiceJsonLd name="OMA API" description="Inference" url="https://www.oma-ai.com/pricing" />,
		);
		const script = container.querySelector('script[type="application/ld+json"]')!;
		expect(JSON.parse(script.textContent!)).toMatchObject({
			"@type": "Service",
			image: "https://www.oma-ai.com/og-image.png",
			url: "https://www.oma-ai.com/pricing",
			provider: { "@id": "https://www.oma-ai.com/#organization" },
		});
		expect(JSON.parse(script.textContent!).offers).toBeUndefined();
	});

	it("keeps a supplied service image in the emitted schema", () => {
		const { container } = render(
			<ServiceJsonLd name="OMA API" description="Inference" url="https://www.oma-ai.com/pricing" image="https://www.oma-ai.com/logos/oma-icon-512.png" />,
		);
		const script = container.querySelector('script[type="application/ld+json"]')!;
		expect(JSON.parse(script.textContent!).image).toBe("https://www.oma-ai.com/logos/oma-icon-512.png");
	});

	it("escapes markup in service text without changing the JSON value", () => {
		const name = "</script><script>alert(1)</script>";
		const { container } = render(
			<ServiceJsonLd name={name} description="Inference" url="https://www.oma-ai.com/pricing" />,
		);
		const scripts = container.querySelectorAll('script[type="application/ld+json"]');
		expect(scripts).toHaveLength(1);
		expect(scripts[0].textContent).not.toContain("<");
		expect(JSON.parse(scripts[0].textContent!).name).toBe(name);
	});
});
