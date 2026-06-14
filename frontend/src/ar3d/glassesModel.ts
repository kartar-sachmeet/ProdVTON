import * as THREE from "three";

export type FrameStyle = "round" | "square" | "aviator";

/**
 * Procedural 3D eyeglasses, sized in a canonical space where the two lens
 * centers sit at x = ±0.5 (so a uniform scale by the interocular distance in
 * pixels lands them on the eyes). Temples extend toward -z (behind the head)
 * so the occluder can hide them when the head turns. PBR metal so scene
 * lighting reads as real, unlike the old flat sprite.
 */
export function buildGlasses(style: FrameStyle, colorHex: number, tinted: boolean): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.6,
    roughness: 0.35,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: tinted ? 0x1a1e24 : 0xbfd4e6,
    transparent: true,
    opacity: tinted ? 0.55 : 0.18,
    roughness: 0.1,
    metalness: 0,
    transmission: tinted ? 0 : 0.6,
  });

  const lensR = 0.34;
  const tube = 0.045;

  for (const sign of [-1, 1]) {
    const cx = sign * 0.5;
    // Rim
    let rim: THREE.Mesh;
    if (style === "round") {
      rim = new THREE.Mesh(new THREE.TorusGeometry(lensR, tube, 16, 48), frameMat);
    } else {
      // square / aviator approximated with a rounded-rect extrusion via TorusGeometry scaled
      rim = new THREE.Mesh(new THREE.TorusGeometry(lensR, tube, 16, 48), frameMat);
      rim.scale.set(1.15, style === "aviator" ? 0.78 : 0.92, 1);
    }
    rim.position.set(cx, 0, 0);
    group.add(rim);

    // Lens fill
    const lens = new THREE.Mesh(new THREE.CircleGeometry(lensR, 40), lensMat);
    lens.position.set(cx, 0, -0.005);
    if (style !== "round") lens.scale.set(1.15, style === "aviator" ? 0.78 : 0.92, 1);
    group.add(lens);

    // Temple (arm) going back toward the ear
    const temple = new THREE.Mesh(new THREE.BoxGeometry(1.0, tube * 1.2, tube * 1.2), frameMat);
    temple.position.set(sign * (1.0), 0.12, -0.5);
    temple.rotation.y = sign * 0.5;
    group.add(temple);
  }

  // Bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.28, tube * 1.4, tube * 1.4), frameMat);
  bridge.position.set(0, 0.12, 0);
  group.add(bridge);

  return group;
}
