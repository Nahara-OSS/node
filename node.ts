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

import type { TypeDesc } from "./type.ts";

/**
 * ## What is a node?
 *
 * In math context, a node is basically a function that have 0 or more inputs and can produce 0 or more outputs. The
 * math notation for node is basically like this:
 *
 * ```
 * y = f(x)
 * ```
 *
 * where `y` is the node output and `x` is the node input. Both `x` and `y` is a vector of values, which can have 0 or
 * more elements.
 *
 * To explain how node graph works for users that aren't familiar with nodes, it might worth comparing node system to a
 * chain of factories, where each factory consume resources OR product produced by other factories, do some
 * manufacturing, and then produce products for other factories OR consumers to consume. Each input socket represent
 * something coming into the factory, and each output socket represent something coming from the factory. Factory may
 * also produce byproducts, which may also be used by other factories down the line (in this case, it is represented as
 * two or more output sockets).
 *
 * ## Node configuration
 *
 * The configuration of a node determine the input and output sockets, as well as how the node should evaluate. One can
 * think of node configuration as "hyperparameters", since it controls the signature of the function. Node configuration
 * in Nahara's Node must be _immutable_:
 *
 * "Modifications" to the configuration must not done directly onto the configuration itself (a.k.a you should not be
 * using `config.field = newValue` to edit the configuration). To "modify" the configuration, you need to reconstruct
 * the configuration with new values:
 *
 * ```typescript
 * config = { ...config, field: newValue };
 * ```
 *
 * This pattern is highly recommended when working with most front-end frameworks, such as React, Preact and Svelte:
 *
 * ```typescriptreact
 * export function NodeConfigUI({ config, onUpdateConfig: updateConfig }: {
 *     config: NodeConfig,
 *     onUpdateConfig: (updater: (config: NodeConfig) => NodeConfig) => void
 * }) {
 *     function setFieldInConfig(newValue: NodeConfig["field"]) {
 *         changeConfig(config => ({ ...config, field: newValue }));
 *     }
 *
 *     return (
 *         <button type="button" onclick={setFieldInConfig("new value")}>
 *             Set field in config
 *         </button>
 *     );
 * }
 * ```
 *
 * ```svelte
 * <script lang="ts">
 *     const { config, onUpdateConfig: updateConfig }: {
 *         config: NodeConfig,
 *         onUpdateConfig: (updater: (config: NodeConfig) => NodeConfig) => void
 *     } = $props();
 *
 *     function setFieldInConfig(newValue: NodeConfig["field"]) {
 *         changeConfig(config => ({ ...config, field: newValue }));
 *     }
 * </script>
 *
 * <button type="button" onclick={setFieldInConfig("new value")}>
 *     Set field in config
 * </button>
 * ```
 *
 * ## Evaluate-style node graph
 *
 * Nahara's Node is based on evaluate-style node graph, which means the host would evaluate the graph to obtain the
 * values. Each node consume values produced by anything connected to inputs (or fallback to default if input socket is
 * not connected to anything) and produces output values for other nodes to consume.
 *
 * ```typescript
 * const MathNode: NodeType<{ a: number, b: number }, { output: number }, "+" | "-" | "*" | "/"> = {
 *     typeId: "math-node",
 *     label: "Math node",
 *     initialConfig: "+",
 *
 *     input: () => ({
 *         a: { label: "A", type: { type: "number" }, default: 0 },
 *         b: { label: "B", type: { type: "number" }, default: 0 }
 *     }),
 *
 *     output: () => ({
 *         output: { label: "Out", type: { type: "number" } }
 *     }),
 *
 *     evaluate: ({ a, b }, config) => {
 *         switch (config) {
 *             case "+": return { output: a + b };
 *             case "-": return { output: a - b };
 *             case "*": return { output: a * b };
 *             case "/": return { output: a / b };
 *         }
 *     }
 * };
 * ```
 *
 * In case where environment access is required, the `registry()` can be replaced by a function that replaces a node
 * with specific type ID with different `evaluate()` function that access the environment:
 *
 * ```typescript
 * export function eval(graph: NodeGraph, registry: (typeId: string) => AnyNodeType, universe: number = 42) {
 *     const flattened = flatten(graph);
 *     const evalGraph = buildEvalGraph(flattened, ["the-node-id"]);
 *     const result = evalGraph(typeId => {
 *         if (typeId == UniverseNode.typeId) return { ...UniverseNode, evaluate: () => ({ answer: universe }) };
 *         return registry(typeId);
 *     });
 *     return result.get("the-node-id")!["output"];
 * }
 * ```
 *
 * ## Trigger-style node graph
 *
 * Although the node graph in Nahara's Node is based on evaluate-style node graph, the whole thing can be converted to
 * trigger-style by using function as socket type:
 *
 * ```typescript
 * const Producer: NodeType<{}, { output: (consume: (value: number) => void) => void }, void> = {
 *     // ...
 *
 *     output: () => ({
 *         output: {
 *             label: "Output",
 *             type: { type: "named", name: "signal" }
 *         }
 *     }),
 *
 *     evaluate: () => ({
 *         output: (consume) => {
 *             setInterval(() => consume(42), 1000);
 *         }
 *     })
 * };
 *
 * const Consumer: NodeType<{ input: (consume: (value: number) => void) => void }, void> = {
 *     // ...
 *
 *     input: () => ({
 *         label: "Input",
 *         type: { type: "named", name: "signal" }
 *         default: () => {}
 *     }),
 *
 *     evaluate: ({ input }) => {
 *         input(value => {
 *             console.log("Received", value);
 *         });
 *     }
 * };
 * ```
 *
 * When `evaluate()` of `Consumer` is called, it will subscribe to the `Producer`. To assign cleanup function (that
 * can be used to clear interval for producer in this case), consider providing the node through `registry()` function
 * when evaluating the node graph.
 *
 * ```typescript
 * const eval = buildEvalGraph(flatten(myGraph), ["id-of-target-node"]);
 * const tasks: number[] = [];
 *
 * eval(typeId => {
 *     if (typeId == Producer.typeId) {
 *         return {
 *             ...Producer,
 *
 *            evaluate: () => ({
 *                output: (consume) => {
 *                    const task = setInterval(() => consume(42), 1000);
 *                    tasks.push(task);
 *                }
 *            })
 *         };
 *     }
 *
 *     return registry(typeId);
 * });
 *
 * export const cleanup = () => tasks.forEach(task => clearInterval(task));
 * ```
 *
 * @template Input Input for node evaluation.
 * @template Output Output produced from node evaluation.
 * @template Config The configuration for the node. The configuration is updated by user and used during node
 * evaluation.
 */
export interface NodeType<
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    Config,
> {
    /**
     * The ID of this node type.
     */
    readonly typeId: string;

    /**
     * The label of the node type.
     */
    readonly label: string;

    /**
     * The initial configuration for the node. The configuration is then altered further by user through user interface.
     */
    readonly initialConfig: Config;

    /**
     * Get descriptor for input sockets based on specific node configuration.
     *
     * @param config The configuration corresponding to input sockets.
     */
    input(config: Config): {
        readonly [x in keyof Input]: {
            readonly label: string;
            readonly type: TypeDesc<Input[x]>;
            readonly default: Input[x];
        };
    };

    /**
     * Get descriptor for output socket based on specific node configuration.
     *
     * @param config The configuration corresponding to output sockets.
     */
    output(config: Config): {
        readonly [x in keyof Output]: {
            readonly label: string;
            readonly type: TypeDesc<Output[x]>;
        };
    };

    /**
     * Evaluate the node.
     *
     * @param input Input coming to this node.
     * @param config The node configuration being used for evaluation.
     */
    evaluate(input: Input, config: Config): Output;
}

// deno-lint-ignore no-explicit-any
export type AnyNodeType = NodeType<any, any, any>;
