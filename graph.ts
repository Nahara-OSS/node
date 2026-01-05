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

import type { AnyNodeType } from "./node.ts";
import type { AnyTypeDesc } from "./type.ts";

export interface NodeGraph {
    readonly graph: readonly GraphElement[];
}

export interface BaseGraphElement {
    readonly elementId: string;
    readonly label: string | null;
}

export interface Positionable {
    readonly x: number;
    readonly y: number;
    readonly width: number;
}

/**
 * Frame element groups a collection of child elements into a rectangle, which then can be moved around by user to move
 * a group of elements at the same time.
 */
export interface FrameElement extends BaseGraphElement {
    readonly elementType: "frame";
    readonly childrenIds: readonly string[];
}

/**
 * Node element consume inputs coming to it, evaluates and then return outputs for other nodes to consume.
 */
export interface NodeElement extends BaseGraphElement, Positionable {
    readonly elementType: "node";
    readonly typeId: string;
    readonly config: unknown;
    readonly incoming: Readonly<Record<string, Incoming>>;
}

/**
 * Basically a subgraph.
 */
export interface GroupElement extends BaseGraphElement, NodeGraph, Positionable {
    readonly elementType: "group";
    readonly incoming: Readonly<Record<string, Incoming>>;
}

/**
 * Element providing sockets exported from outside world to group.
 */
export interface GroupInputElement extends BaseGraphElement, Positionable {
    readonly elementType: "group-input";
    readonly exports: readonly GroupInputExport[];
}

/**
 * Element outputting sockets exported to outside world from group.
 */
export interface GroupOutputElement extends BaseGraphElement, Positionable {
    readonly elementType: "group-output";
    readonly exports: readonly GroupOutputExport[];
}

export type GraphElement =
    | FrameElement
    | NodeElement
    | GroupElement
    | GroupInputElement
    | GroupOutputElement;

/**
 * Socket reference for incoming sockets. A socket reference consists element holding the socket and socket name.
 */
export interface Incoming {
    readonly elementId: string;
    readonly socket: string;
}

export interface GroupInputExport {
    readonly id: string;
    readonly label: string | null;
    readonly type: AnyTypeDesc;
}

export interface GroupOutputExport {
    readonly id: string;
    readonly label: string | null;
    readonly type: AnyTypeDesc;
    readonly target: Incoming;
}

/**
 * Flatten complex node graph to simple node graph.
 *
 * @param graph The complex node graph to flatten.
 * @returns The flattened node graph.
 */
export function flatten(graph: NodeGraph): readonly NodeElement[] {
    const flattened: NodeElement[] = [];
    const redirects = new Map<`${string}::${string}`, Incoming>();

    for (const element of graph.graph) {
        if (element.elementType == "node") {
            flattened.push(element);
            continue;
        }

        if (element.elementType == "group") {
            const groupIn = element.graph.find((e) => e.elementType == "group-input");
            const groupOut = element.graph.find((e) => e.elementType == "group-output");
            if (!groupIn || !groupOut) throw new Error(`Group ${element.elementId} must have input and output`);
            groupIn.exports.forEach((e) => redirects.set(`${groupIn.elementId}::${e.id}`, element.incoming[e.id]));
            groupOut.exports.forEach((e) => redirects.set(`${element.elementId}::${e.id}`, e.target));
            flattened.push(...flatten(element));
            continue;
        }
    }

    let result = flattened;
    let changed: boolean;

    do {
        // Perform multiple rounds of flattening until it can't flatten anymore
        changed = false;
        result = result.map((e) => {
            const incoming = { ...e.incoming };

            for (const socket in incoming) {
                const redirectTo = redirects.get(`${incoming[socket].elementId}::${incoming[socket].socket}`);

                if (redirectTo) {
                    changed = true;
                    incoming[socket] = redirectTo;
                }
            }

            return changed ? { ...e, incoming } : e;
        });
    } while (changed);

    return result;
}

/**
 * Evaluation graph.
 */
export type EvalGraph = (registry: (typeId: string) => AnyNodeType) => ReadonlyMap<string, Record<string, unknown>>;

/**
 * Build evaluation graph.
 *
 * @param graph The flattened node graph (from {@link flatten}).
 * @param targetIds A list of IDs of node elements to evaluate.
 * @returns Built node graph ready for evaluation.
 */
export function buildEvalGraph(graph: readonly NodeElement[], targetIds: readonly string[]): EvalGraph {
    const evalOrder: NodeElement[] = [];

    for (const elementId of targetIds) {
        const element = graph.find((e) => e.elementId == elementId);
        if (!element) throw new Error(`Unable to find element with ID ${elementId}`);

        const stack = [element];
        let top: NodeElement | undefined;

        while ((top = stack.pop()) != null) {
            if (evalOrder.includes(top)) continue;
            evalOrder.unshift(top);

            for (const socket in top.incoming) {
                const element = graph.find((e) => e.elementId == top!.incoming[socket].elementId);
                if (!element) continue;
                stack.push(element);
            }
        }
    }

    return (registry: (typeId: string) => AnyNodeType) => {
        const results = new Map<string, Record<string, unknown>>();

        for (const element of evalOrder) {
            const type = registry(element.typeId);
            const inputDesc = type.input(element.config);
            const input: Record<string, unknown> = {};

            for (const socket in inputDesc) {
                if (element.incoming[socket]) {
                    const result = results.get(element.incoming[socket].elementId);
                    if (!result) throw new Error(`BUG! Failed to obtain result from previous element`);
                    input[socket] = result[element.incoming[socket].socket];
                } else {
                    input[socket] = inputDesc[socket].default;
                }
            }

            const output = type.evaluate(input, element.config);
            results.set(element.elementId, output);
        }

        return results;
    };
}
