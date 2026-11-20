// SPDX-FileCopyrightText: 2026 xmlsax-typescript AUTHORS
//
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { OpenTagToken, TextToken, XmlSaxError, XmlSaxParser } from "../src/index";
import { getAttrValue } from "./helpers";

function captureError(run: () => void): XmlSaxError {
  try {
    run();
  } catch (err) {
    return err as XmlSaxError;
  }
  throw new Error("Expected XmlSaxError to be thrown");
}

describe("entities", () => {
  it("decodes entities in text and attributes", () => {
    let text = "";
    let attr = "";

    const parser = new XmlSaxParser();

    for (const token of parser.feed("<root a='&lt; &amp; &#x41; &#65;'>&lt;&amp;&#x41;&#65;</root>")) {
      if (token instanceof TextToken) {
        text += token.text;
      }
      if (token instanceof OpenTagToken) {
        attr = getAttrValue(token.tag, "a");
      }
    }
    parser.close();

    expect(text).toBe("<&AA");
    expect(attr).toBe("< & A A");
  });

  it("throws on unknown entity", () => {
    const parser = new XmlSaxParser();

    const error = captureError(() => {
      parser.feed("<root>&bogus;</root>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
  });

  it("throws on invalid numeric entities", () => {
    const outOfRange = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root>&#x110000;</root>");
      parser.close();
    });

    const surrogate = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root>&#xD800;</root>");
      parser.close();
    });

    expect(outOfRange).toBeInstanceOf(XmlSaxError);
    expect(surrogate).toBeInstanceOf(XmlSaxError);
  });

  it("throws on unterminated entities", () => {
    const error = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root>&amp</root>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
  });

  it("throws on malformed numeric entities", () => {
    const malformedHex = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root>&#xZZ;</root>");
      parser.close();
    });

    const missingDigits = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root>&#;</root>");
      parser.close();
    });

    const missingHexDigits = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root>&#x;</root>");
      parser.close();
    });

    expect(malformedHex).toBeInstanceOf(XmlSaxError);
    expect(missingDigits).toBeInstanceOf(XmlSaxError);
    expect(missingHexDigits).toBeInstanceOf(XmlSaxError);
  });

  describe("error positions", () => {
    function parseError(chunks: string[], options: ConstructorParameters<typeof XmlSaxParser>[0] = {}): XmlSaxError {
      return captureError(() => {
        const parser = new XmlSaxParser(options);
        for (const chunk of chunks) {
          parser.feed(chunk);
        }
        parser.close();
      });
    }

    function location(error: XmlSaxError): { message: string; line: number; column: number; offset: number } {
      return { message: error.message, line: error.line, column: error.column, offset: error.offset };
    }

    it("reports the document position of an unknown entity in text", () => {
      expect(location(parseError(["<root>\n  <item>&unknown;</item>\n</root>"]))).toEqual({
        message: "Unknown entity: &unknown; at 2:9",
        line: 2,
        column: 9,
        offset: 15
      });
    });

    it("reports the document position of an unknown entity in an attribute", () => {
      expect(location(parseError(["<root>\n  <item a=\"ok &unknown;\"/>\n</root>"]))).toEqual({
        message: "Unknown entity: &unknown; at 2:15",
        line: 2,
        column: 15,
        offset: 21
      });
    });

    it("reports the document position of an unterminated entity", () => {
      expect(location(parseError(["<root>\n  <item>&amp</item>\n</root>"]))).toEqual({
        message: "Unterminated entity at 2:9",
        line: 2,
        column: 9,
        offset: 15
      });
    });

    it("points at the offending entity after valid entities and newlines", () => {
      const text = location(parseError(["<root>&amp;\n&lt; &bad;</root>"]));
      expect(text).toMatchObject({ line: 2, column: 6, offset: 17 });

      const attr = location(parseError(["<root a='&amp;\n&bad;'/>"]));
      expect(attr).toMatchObject({ line: 2, column: 1, offset: 15 });
    });

    it("accounts for CRLF normalization when locating the entity", () => {
      const error = location(parseError(["<root>a\r\nb &bad;</root>"]));
      expect(error).toMatchObject({ line: 2, column: 3, offset: 11 });
    });

    it.each([
      { name: "standalone CR in text", xml: "<r>x\r&bad;</r>", column: 1, offset: 5 },
      { name: "standalone CR in an attribute", xml: "<r a='x\r&bad;'/>", column: 1, offset: 8 },
      { name: "standalone CR in preceding markup", xml: "<r\r>&bad;</r>", column: 2, offset: 4 },
      { name: "CRLF in text", xml: "<r>x\r\n&bad;</r>", column: 1, offset: 6 }
    ])("locates an entity after $name at every chunk boundary", ({ xml, column, offset }) => {
      for (let split = 0; split <= xml.length; split += 1) {
        const error = parseError([xml.slice(0, split), xml.slice(split)]);
        expect(error).toBeInstanceOf(XmlSaxError);
        expect(error).toMatchObject({ line: 2, column, offset });
      }
    });

    it("reports document positions when the entity spans chunks", () => {
      const error = location(parseError(["<root>\n  <item>&unk", "nown;</item>\n</root>"]));
      expect(error).toMatchObject({ line: 2, column: 9, offset: 15 });
    });

    it("counts LF as a new line when a newline-free chunk follows CR", () => {
      const text = "x".repeat(1024);
      const error = parseError(["<r>\r", text, "\n&bad;</r>"]);
      expect(error).toMatchObject({ line: 3, column: 1, offset: 5 + text.length });
    });

    it("reports the document offset with zero line/column when trackPosition is false", () => {
      const error = location(parseError(["<root>\n  <item a=\"ok &unknown;\"/>\n</root>"], { trackPosition: false }));
      expect(error).toEqual({ message: "Unknown entity: &unknown; at 0:0", line: 0, column: 0, offset: 21 });
    });
  });
});
