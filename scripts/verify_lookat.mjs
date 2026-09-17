import * as THREE from 'three';

// 模擬精靈矢雨的真實參數
const startPos = new THREE.Vector3(-250, 0, 0);
const endPos = new THREE.Vector3(250, 0, 0);
const arcHeight = 90;
const scale = 0.7;

function simulateBullet(angle) {
  const trackGroup = new THREE.Group();
  const multiArcGroup = new THREE.Group();
  trackGroup.add(multiArcGroup);

  const itemGroup = new THREE.Group();
  multiArcGroup.add(itemGroup);

  const coneGeo = new THREE.ConeGeometry(7 * scale, 48 * scale, 8);
  coneGeo.rotateX(angle);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial());
  itemGroup.add(cone);

  // 模擬進度 localP = 0.3
  const localP = 0.3;
  const p0 = startPos;
  const p2 = endPos;
  const p1 = new THREE.Vector3().addVectors(p0, p2).multiplyScalar(0.5);
  p1.y += arcHeight;

  const oneMinusT = 1.0 - localP;
  const posX = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * localP * p1.x + localP * localP * p2.x;
  const posY = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * localP * p1.y + localP * localP * p2.y;
  const posZ = oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * localP * p1.z + localP * localP * p2.z;
  itemGroup.position.set(posX, posY, posZ);

  const nextP = Math.min(1.0, localP + 0.02);
  const oMtNext = 1.0 - nextP;
  const nextX = oMtNext * oMtNext * p0.x + 2 * oMtNext * nextP * p1.x + nextP * nextP * p2.x;
  const nextY = oMtNext * oMtNext * p0.y + 2 * oMtNext * nextP * p1.y + nextP * nextP * p2.y;
  const nextZ = oMtNext * oMtNext * p0.z + 2 * oMtNext * nextP * p1.z + nextP * nextP * p2.z;
  const lookTarget = new THREE.Vector3(nextX, nextY, nextZ);

  itemGroup.lookAt(lookTarget);

  trackGroup.updateMatrixWorld(true);

  // 取得尖端（沿局部 Y 軸正方向 24 * scale，旋轉 angle 後）在世界坐標的位置
  const localApex = new THREE.Vector3(0, 24 * scale, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const localBase = new THREE.Vector3(0, -24 * scale, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), angle);

  const worldApex = localApex.clone().applyMatrix4(cone.matrixWorld);
  const worldBase = localBase.clone().applyMatrix4(cone.matrixWorld);

  console.log(`=== angle = ${angle === Math.PI / 2 ? '+Math.PI / 2' : '-Math.PI / 2'} ===`);
  console.log(`  當前位置: (${posX.toFixed(1)}, ${posY.toFixed(1)})`);
  console.log(`  目標前進點: (${nextX.toFixed(1)}, ${nextY.toFixed(1)})`);
  console.log(`  世界坐標 尖端: (${worldApex.x.toFixed(1)}, ${worldApex.y.toFixed(1)})`);
  console.log(`  世界坐標 底座: (${worldBase.x.toFixed(1)}, ${worldBase.y.toFixed(1)})`);
  const forwardX = nextX - posX;
  const apexDistToTarget = worldApex.distanceTo(lookTarget);
  const baseDistToTarget = worldBase.distanceTo(lookTarget);
  console.log(`  尖端到前進點距離: ${apexDistToTarget.toFixed(2)}, 底座到前進點距離: ${baseDistToTarget.toFixed(2)}`);
  if (apexDistToTarget < baseDistToTarget) {
    console.log(`  👉 尖端更接近目標 ➔ 朝向前方【正確】\n`);
  } else {
    console.log(`  👉 尖端遠離目標 ➔ 屁股朝前、尖端朝後【反了】\n`);
  }
}

simulateBullet(Math.PI / 2);
simulateBullet(-Math.PI / 2);
