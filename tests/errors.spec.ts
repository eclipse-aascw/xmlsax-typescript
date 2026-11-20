// SPDX-FileCopyrightText: 2026 xmlsax-typescript AUTHORS
//
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  ObjectBuilder,
  TreeBuilder,
  XmlSaxBuildError,
  XmlSaxError,
  XmlSaxLibraryError,
  XmlSaxParser,
  buildXmlNode
} from "../src/index";

function captureError(run: () => void): XmlSaxError {
  try {
    run();
  } catch (err) {
    return err as XmlSaxError;
  }
  throw new Error("Expected XmlSaxError to be thrown");
}

describe("error handling", () => {
  it("reports mismatched closing tag positions", () => {
    const parser = new XmlSaxParser();
    const error = captureError(() => {
      parser.feed("<root>\n</rot>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
    expect(error.line).toBe(2);
    expect(error.column).toBe(1);
    expect(error.offset).toBe(7);
  });

  it("throws on closing tag without a start tag", () => {
    const parser = new XmlSaxParser();
    const error = captureError(() => {
      parser.feed("</root>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
  });

  it("rejects unterminated markup", () => {
    const cases = [
      "<!--",
      "<![CDATA[",
      "<?pi",
      "<!DOCTYPE root",
      "<root"
    ];

    for (const xml of cases) {
      const parser = new XmlSaxParser();
      const error = captureError(() => {
        parser.feed(xml);
        parser.close();
      });
      expect(error).toBeInstanceOf(XmlSaxError);
    }
  });

  it("rejects unquoted attribute values", () => {
    const parser = new XmlSaxParser();
    const error = captureError(() => {
      parser.feed("<root a=1/>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
  });

  it("rejects duplicate attributes", () => {
    for (const options of [{}, { xmlns: false }, { includeNamespaceAttributes: true }]) {
      const error = captureError(() => {
        const parser = new XmlSaxParser(options);
        parser.feed("<root>\n  <item a=\"1\" b=\"x\" a=\"2\"/>\n</root>");
        parser.close();
      });

      expect(error).toBeInstanceOf(XmlSaxError);
      expect(error.message).toBe("Duplicate attribute: a at 2:3");
      expect(error.offset).toBe(9);
    }
  });

  it("rejects duplicate attributes with the same expanded name", () => {
    const error = captureError(() => {
      const parser = new XmlSaxParser();
      parser.feed("<root xmlns:p=\"urn:x\" xmlns:q=\"urn:x\" p:a=\"1\" q:a=\"2\"/>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
    expect(error.message).toBe("Duplicate attribute: q:a (expanded name {urn:x}a) at 1:1");
  });

  it("rejects duplicate namespace declarations", () => {
    for (const options of [{}, { includeNamespaceAttributes: true }]) {
      const error = captureError(() => {
        const parser = new XmlSaxParser(options);
        parser.feed("<root xmlns:p=\"urn:x\" xmlns:p=\"urn:y\"/>");
        parser.close();
      });

      expect(error).toBeInstanceOf(XmlSaxError);
      expect(error.message).toBe("Duplicate attribute: xmlns:p at 1:1");
    }
  });

  it("accepts attributes that differ only by namespace or prefix binding", () => {
    const parser = new XmlSaxParser();
    const tokens = [
      ...parser.feed("<root xmlns:p=\"urn:x\" xmlns:q=\"urn:y\" a=\"0\" p:a=\"1\" q:a=\"2\" xmlns=\"urn:d\"/>"),
      ...parser.close()
    ];
    expect(tokens.length).toBeGreaterThan(0);

    const plain = new XmlSaxParser({ xmlns: false });
    expect(() => {
      plain.feed("<root xmlns:p=\"urn:x\" xmlns:q=\"urn:x\" p:a=\"1\" q:a=\"2\"/>");
      plain.close();
    }).not.toThrow();
  });

  it("blocks doctype when disallowed", () => {
    const parser = new XmlSaxParser({ allowDoctype: false });
    const error = captureError(() => {
      parser.feed("<!DOCTYPE root><root/>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
  });

  it("can disable line/column tracking for faster parsing", () => {
    const parser = new XmlSaxParser({ trackPosition: false });
    const error = captureError(() => {
      parser.feed("<root>\n</rot>");
      parser.close();
    });

    expect(error).toBeInstanceOf(XmlSaxError);
    expect(error.offset).toBe(7);
    expect(error.line).toBe(0);
    expect(error.column).toBe(0);
  });

  it("uses structured error type for object builder invalid states", () => {
    const builder = new ObjectBuilder();

    expect(() => builder.getResult()).toThrow(XmlSaxBuildError);
    expect(() => builder.onCloseTag()).toThrow(XmlSaxBuildError);

    try {
      builder.getRootName();
    } catch (error) {
      expect(error).toBeInstanceOf(XmlSaxBuildError);
      expect(error).toBeInstanceOf(XmlSaxLibraryError);
    }
  });

  it("uses structured error type for tree builder invalid states", () => {
    const builder = new TreeBuilder();
    expect(() => builder.getRoot()).toThrow(XmlSaxBuildError);
    expect(() => builder.onCloseTag()).toThrow(XmlSaxBuildError);
  });

  it("uses structured error type for xml builder invalid root state", () => {
    expect(() => buildXmlNode({ a: "1", b: "2" })).toThrow(XmlSaxBuildError);
  });
});
