/*
 * The MIT License (MIT)
 *
 * Copyright © 2025 The Nahara's Creative Suite contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the “Software”), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Geometry module for dealing with geometry of graph elements.
 *
 * @module
 */

import type { GraphElement, NodeGraph } from "./graph.ts";
import type { NodeType } from "./node.ts";

export interface Geometry {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

// function scaledPointInRect(x: number, y: number, rect: Geometry): readonly [u: number, v: number] {
//     return [(x - rect.x) / rect.width, (y - rect.y) / rect.height];
// }

// function unscaledPointInRect(u: number, v: number, rect: Geometry): readonly [x: number, y: number] {
//     return [u * rect.width + rect.x, v * rect.height + rect.y];
// }

/**
 * Measure the bounding box of specific element in node graph.
 *
 * @param graph The node graph containing all the elements.
 * @param element The element to measure the bounding box.
 * @param socketHeight The height for each socket.
 * @param registry The registry for obtaining node type from type ID.
 * @returns The measured bounding box of the element.
 */
export function calculate(
    graph: NodeGraph,
    element: GraphElement,
    socketHeight: number,
    // deno-lint-ignore no-explicit-any
    registry: (typeId: string) => NodeType<any, any, any>,
): Geometry {
    switch (element.elementType) {
        case "node": {
            const { x, y, width } = element;
            const type = registry(element.typeId);
            const inputs = Object.keys(type.input(element.config)).length;
            const outputs = Object.keys(type.output(element.config)).length;
            const height = (inputs + outputs) * socketHeight;
            return { x, y, width, height };
        }
        case "group": {
            const { x, y, width } = element;
            const inputs = element.graph.find((e) => e.elementType == "group-input")?.exports.length ?? 0;
            const outputs = element.graph.find((e) => e.elementType == "group-output")?.exports.length ?? 0;
            const height = (inputs + outputs) * socketHeight;
            return { x, y, width, height };
        }
        case "frame": {
            return graph.graph
                .filter((e) => element.childrenIds.includes(e.elementId))
                .reduce<Geometry | null>((acc, e) => {
                    const g = calculate(graph, e, socketHeight, registry);
                    if (!acc) return g;

                    const x = Math.min(acc.x, g.x);
                    const y = Math.min(acc.y, g.y);

                    return {
                        x,
                        y,
                        width: Math.max(acc.x + acc.width, g.x + g.width) - x,
                        height: Math.max(acc.y + acc.height, g.y + g.height) - y,
                    };
                }, null) ?? { x: 0, y: 0, width: 0, height: 0 };
        }
        default:
            throw new Error(`Unable to calculate geometry for ${(element as GraphElement).elementType}`);
    }
}
