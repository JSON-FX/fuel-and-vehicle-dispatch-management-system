import {
  type KyselyPlugin,
  OperationNodeTransformer,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  SelectModifierNode,
  type SelectQueryNode,
  sql,
  type UnknownRow,
} from 'kysely';

class MaxExecutionTimeTransformer extends OperationNodeTransformer {
  constructor(private readonly timeoutMs: number) {
    super();
  }

  protected override transformSelectQuery(node: SelectQueryNode): SelectQueryNode {
    const transformed = super.transformSelectQuery(node);
    const hint = sql.raw(`/*+ MAX_EXECUTION_TIME(${this.timeoutMs}) */`).toOperationNode();
    return {
      ...transformed,
      frontModifiers: [
        ...(transformed.frontModifiers ?? []),
        SelectModifierNode.createWithExpression(hint),
      ],
    };
  }
}

export class MysqlMaxExecutionTimePlugin implements KyselyPlugin {
  private readonly transformer: MaxExecutionTimeTransformer;

  constructor(timeoutMs: number) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new TypeError('MySQL query timeout must be a positive safe integer.');
    }
    this.transformer = new MaxExecutionTimeTransformer(timeoutMs);
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.transformer.transformNode(args.node, args.queryId);
  }

  transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(args.result);
  }
}
