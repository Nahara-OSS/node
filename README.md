# Nahara's Node Graph
Node graph evaluation module.

## Usage
```typescript
import { type AnyNodeType, buildEvalGraph, flatten, type NodeGraph, type NodeType } from "@nahara/node";

// Make a constant value node
// This node always return the configured value
// deno-lint-ignore ban-types
const ConstNode: NodeType<{}, { output: number }, number> = {
    typeId: "const",
    label: "Constant",
    initialConfig: 0,

    input: () => ({
    }),

    output: () => ({
        output: { label: "Value", type: { type: "number" } },
    }),

    evaluate: (_, output) => ({ output }),
};

// Make a math node
// This node performs arithmetic operation
const MathNode: NodeType<{ a: number; b: number }, { output: number }, "+" | "-" | "*" | "/"> = {
    typeId: "math",
    label: "Math",
    initialConfig: "+",

    input: () => ({
        a: { label: "A", type: { type: "number" }, default: 0 },
        b: { label: "B", type: { type: "number" }, default: 0 },
    }),

    output: () => ({
        output: { label: "Value", type: { type: "number" } },
    }),

    evaluate: ({ a, b }, op) => {
        switch (op) {
            case "+": return { output: a + b };
            case "-": return { output: a - b };
            case "*": return { output: a * b };
            case "/": return { output: a / b };
        }
    },
};

// Make a registry consists of 2 nodes
const nodes = new Map<string, AnyNodeType>([
    [ConstNode.typeId, ConstNode],
    [MathNode.typeId, MathNode],
]);

const registry = (typeId: string) => {
    const type = nodes.get(typeId);
    if (!type) throw new Error(`No such node with type ${typeId}`);
    return type;
};

// Make a node graph
// Normally the graph is created by user
const graph: NodeGraph = {
    graph: [
        {
            elementId: "const/a",
            elementType: "node",
            label: null,
            x: 0,
            y: 0,
            width: 120,
            typeId: ConstNode.typeId,
            config: 42,
            incoming: {},
        },
        {
            elementId: "const/b",
            elementType: "node",
            label: null,
            x: 0,
            y: 32,
            width: 120,
            typeId: ConstNode.typeId,
            config: 17,
            incoming: {},
        },
        {
            elementId: "math/add",
            elementType: "node",
            label: null,
            x: 0,
            y: 16,
            width: 120,
            typeId: MathNode.typeId,
            config: "*",
            incoming: {
                a: { elementId: "const/a", socket: "output" },
                b: { elementId: "const/b", socket: "output" },
            },
        },
    ],
};

// Build and evaluate our node graph
// The graph must be flattened first before it can be built
// The second parameter contains a list of nodes required to be evaluated. If this list is empty, no nodes will be
// evaluated.
const evaluate = buildEvalGraph(flatten(graph), ["math/add"]);
const result = evaluate(registry);

// Our `result` map contains not just `math/add`, but also anything connected to `math/add` as well, either directly or
// indirectly. This is useful for finding which node not connected to anything.
console.log(result.get("math/add")!["output"], "==", 42 * 17);
```

Detailed documentation can be found in [node.ts](node.ts).

## License
MIT License. See [LICENSE](LICENSE) for more details.
