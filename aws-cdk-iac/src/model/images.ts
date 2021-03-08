import {
  attribute,
  hashKey,
  rangeKey,
  table,
} from "@aws/dynamodb-data-mapper-annotations";

@table(process.env.TABLE_IMAGES!)
export class Image {
  @hashKey({ type: "String" })
  id: string;

  @rangeKey({
    type: "Date",
    keyType: "RANGE",
  })
  createdAt: Date;

  @hashKey({ type: "String", keyType: "HASH" })
  hash: string;

  @attribute({ type: "String" })
  fileExt: string;

  @attribute({ type: "String" })
  sourceIp: string;

  @attribute({ type: "String" })
  contentType: string;

  @attribute({ type: "Any" })
  req: any;

  @attribute({ type: "Set", memberType: "String" })
  tags: Set<string>;
}
