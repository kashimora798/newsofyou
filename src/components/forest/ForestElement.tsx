/**
 * ForestElement.tsx
 * Central switcher — picks the right 3D component based on ForestNode type.
 */

import type { ForestNode } from "@/lib/forestParser";
import type { LODLevel } from "@/lib/forestChunks";
import OakTree from "./trees/OakTree";
import CherryBlossom from "./trees/CherryBlossom";
import WillowTree from "./trees/WillowTree";
import PineTree from "./trees/PineTree";
import Redwood from "./trees/Redwood";
import Sunflower from "./plants/Sunflower";
import Wildflower from "./plants/Wildflower";
import Mushroom from "./plants/Mushroom";
import Crystal from "./plants/Crystal";
import Bush from "./plants/Bush";
import { Fern, Bamboo } from "./plants/FernBamboo";

interface Props {
  node: ForestNode;
  lod: LODLevel;
  isMobile: boolean;
  onSelect: (node: ForestNode) => void;
}

export default function ForestElement({ node, lod, isMobile, onSelect }: Props) {
  const shared = {
    position: node.position,
    scale: node.scale,
    colorVariant: node.colorVariant,
    rotation: node.rotation,
    lod,
    isMobile,
    onClick: () => onSelect(node),
  };

  switch (node.type) {
    case "cherry":
      return <CherryBlossom {...shared} hasPetals={node.hasPetals} />;
    case "willow":
      return <WillowTree {...shared} />;
    case "pine":
      return <PineTree {...shared} hasFireflies={node.hasFireflies} />;
    case "redwood":
      return <Redwood {...shared} />;
    case "sunflower":
      return <Sunflower {...shared} />;
    case "wildflower":
      return <Wildflower {...shared} />;
    case "mushroom":
      return <Mushroom {...shared} />;
    case "crystal":
      return <Crystal {...shared} />;
    case "bush":
      return <Bush {...shared} />;
    case "fern":
      return <Fern {...shared} />;
    case "bamboo":
      return <Bamboo {...shared} />;
    case "oak":
    default:
      return <OakTree {...shared} />;
  }
}
