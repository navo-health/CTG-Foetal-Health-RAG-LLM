import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

function FetalModel3D({ ctgData, darkMode }) {
  const { scene, nodes, materials, animations } = useGLTF('/fetus.glb');
  const groupRef = useRef();
  
  // References to the three sub-parts
  const wombRef = useRef();
  const fetusRef = useRef();
  const heartRef = useRef();
  
  // Animation states
  const [wombScale, setWombScale] = useState(1);
  const [fetusScale, setFetusScale] = useState(1);
  const [heartScale, setHeartScale] = useState(1);
  
  // Animation timing
  const time = useRef(0);
  
  // Store found parts for legend click functionality
  const [foundParts, setFoundParts] = useState({ womb: null, fetus: null, heart: null });
  
  // Debug logging
  console.log('FetalModel3D: Component rendered with ctgData:', ctgData);
  console.log('FetalModel3D: Scene loaded:', scene);
  console.log('FetalModel3D: Scene type:', scene?.type);
  console.log('FetalModel3D: Scene children:', scene?.children);
  console.log('FetalModel3D: Nodes:', nodes);
  console.log('FetalModel3D: Node keys:', nodes ? Object.keys(nodes) : 'No nodes');
  console.log('FetalModel3D: Materials:', materials);
  console.log('FetalModel3D: Material keys:', materials ? Object.keys(materials) : 'No materials');
  console.log('FetalModel3D: Animations:', animations);
  
  // Ensure the scene is visible and preserve its original transform
  useEffect(() => {
    if (scene) {
      scene.visible = true;
      // Don't modify the scene's position, rotation, or scale - preserve Blender export values
    }
  }, [scene]);
  
  // Extract CTG values for animation - safely handle missing data
  const baselineFHR = parseFloat(ctgData?.baseline_value || 120);
  const accelerations = parseFloat(ctgData?.accelerations || 0);
  const uterineContractions = parseFloat(ctgData?.uterine_contractions || 0);
  
  // Debug CTG values
  console.log('FetalModel3D: CTG Values - FHR:', baselineFHR, 'Accelerations:', accelerations, 'Contractions:', uterineContractions);
  
  // Animation parameters
  const wombBaseScale = 1;
  const fetusBaseScale = 1;
  const heartBaseScale = 1;
  
  useFrame((state, delta) => {
    time.current += delta;
    
    // Womb animation based on uterine contractions - reduced intensity
    // Always animate if we have a womb reference, even with 0 contractions for testing
    if (wombRef.current) {
      const contractionIntensity = Math.max(uterineContractions / 10, 0.05); // Reduced minimum from 0.1 to 0.05
      const wombPulse = Math.sin(time.current * 2) * 0.15 * contractionIntensity; // Reduced from 0.3 to 0.15
      const newScale = wombBaseScale + wombPulse;
      setWombScale(newScale);
      console.log('FetalModel3D: Womb animation - wombRef exists:', !!wombRef.current, 'scale:', newScale, 'contractions:', uterineContractions, 'intensity:', contractionIntensity);
    } else {
      console.log('FetalModel3D: No womb reference found for animation');
      setWombScale(wombBaseScale);
    }
    
    // Fetus animation based on accelerations
    if (accelerations > 0) {
      const accelerationIntensity = Math.min(accelerations / 5, 1);
      const fetusPulse = Math.sin(time.current * 1.5) * 0.05 * accelerationIntensity;
      setFetusScale(fetusBaseScale + fetusPulse);
    } else {
      setFetusScale(fetusBaseScale);
    }
    
    // Heart animation based on baseline FHR
    const heartRateVariation = (baselineFHR - 120) / 60; // Normalize around 120 BPM
    const heartBeat = Math.sin(time.current * 4) * 0.08;
    const heartSizeVariation = heartRateVariation * 0.1;
    setHeartScale(heartBaseScale + heartBeat + heartSizeVariation);
  });
  
  // Store original transforms to preserve Blender positioning
  const originalTransforms = useRef({});
  
  // Apply animations to the 3D model parts while preserving original positions
  useEffect(() => {
    if (wombRef.current) {
      // Store original transform on first access
      if (!originalTransforms.current.womb) {
        originalTransforms.current.womb = {
          position: wombRef.current.position.clone(),
          rotation: wombRef.current.rotation.clone(),
          scale: wombRef.current.scale.clone()
        };
        console.log('FetalModel3D: Stored original womb transform:', originalTransforms.current.womb);
      }
      // Apply scale while preserving original position and rotation
      wombRef.current.scale.copy(originalTransforms.current.womb.scale).multiplyScalar(wombScale);
      console.log('FetalModel3D: Applied womb scale:', wombScale, 'to object:', wombRef.current.name || 'unnamed');
    } else {
      console.log('FetalModel3D: No wombRef.current available for animation');
    }
    
    if (fetusRef.current) {
      if (!originalTransforms.current.fetus) {
        originalTransforms.current.fetus = {
          position: fetusRef.current.position.clone(),
          rotation: fetusRef.current.rotation.clone(),
          scale: fetusRef.current.scale.clone()
        };
      }
      fetusRef.current.scale.copy(originalTransforms.current.fetus.scale).multiplyScalar(fetusScale);
    }
    
    if (heartRef.current) {
      if (!originalTransforms.current.heart) {
        originalTransforms.current.heart = {
          position: heartRef.current.position.clone(),
          rotation: heartRef.current.rotation.clone(),
          scale: heartRef.current.scale.clone()
        };
      }
      heartRef.current.scale.copy(originalTransforms.current.heart.scale).multiplyScalar(heartScale);
    }
  }, [wombScale, fetusScale, heartScale]);
  
  // Find and set up the three sub-parts
  useEffect(() => {
    if (scene || nodes) {
      console.log('FetalModel3D: Scene structure:', scene);
      console.log('FetalModel3D: Scene children count:', scene?.children?.length || 0);
      console.log('FetalModel3D: Scene children:', scene?.children);
      
      let foundPartsState = { womb: false, fetus: false, heart: false };
      let foundPartsRefs = { womb: null, fetus: null, heart: null };
      let allNodes = [];
      
      // Try to find parts in the nodes object first
      if (nodes) {
        console.log('FetalModel3D: Checking nodes object for parts...');
        Object.keys(nodes).forEach(nodeName => {
          const node = nodes[nodeName];
          allNodes.push({
            name: nodeName,
            type: node.type,
            uuid: node.uuid,
            visible: node.visible,
            hasGeometry: node.geometry ? true : false,
            hasMaterial: node.material ? true : false
          });
          
          console.log('FetalModel3D: Node from nodes object:', {
            name: nodeName,
            type: node.type,
            visible: node.visible,
            hasGeometry: node.geometry ? true : false,
            hasMaterial: node.material ? true : false,
            position: node.position,
            scale: node.scale
          });
          
          // Check for exact matches and variations - expanded search terms
          const lowerName = nodeName.toLowerCase();
          if (lowerName.includes('womb') || lowerName.includes('uterus') || lowerName.includes('uterine') || 
              nodeName === 'Womb' || nodeName === 'Uterus') {
            wombRef.current = node;
            foundPartsState.womb = true;
            foundPartsRefs.womb = node;
            console.log('FetalModel3D: Found Womb part in nodes:', nodeName);
          } else if (lowerName.includes('fetus') || lowerName.includes('baby') || nodeName === 'Fetus') {
            fetusRef.current = node;
            foundPartsState.fetus = true;
            foundPartsRefs.fetus = node;
            console.log('FetalModel3D: Found Fetus part in nodes:', nodeName);
          } else if (lowerName.includes('heart') || nodeName === 'Heart') {
            heartRef.current = node;
            foundPartsState.heart = true;
            foundPartsRefs.heart = node;
            console.log('FetalModel3D: Found Heart part in nodes:', nodeName);
          }
        });
      }
      
      // If not found in nodes, traverse the scene
      if (scene && (!foundParts.womb || !foundParts.fetus || !foundParts.heart)) {
        console.log('FetalModel3D: Checking scene traverse for parts...');
        scene.traverse((child) => {
          if (!allNodes.some(n => n.uuid === child.uuid)) {
            allNodes.push({
              name: child.name,
              type: child.type,
              uuid: child.uuid,
              visible: child.visible,
              hasGeometry: child.geometry ? true : false,
              hasMaterial: child.material ? true : false
            });
          }
          
          console.log('FetalModel3D: Child node:', {
            name: child.name,
            type: child.type,
            visible: child.visible,
            hasGeometry: child.geometry ? true : false,
            hasMaterial: child.material ? true : false,
            position: child.position,
            scale: child.scale
          });
          
          const lowerName = child.name ? child.name.toLowerCase() : '';
          if (lowerName.includes('womb') || lowerName.includes('uterus') || lowerName.includes('uterine') || 
              child.name === 'Womb' || child.name === 'Uterus') {
            wombRef.current = child;
            foundPartsState.womb = true;
            foundPartsRefs.womb = child;
            console.log('FetalModel3D: Found Womb part in scene:', child.name);
          } else if (lowerName.includes('fetus') || lowerName.includes('baby') || child.name === 'Fetus') {
            fetusRef.current = child;
            foundPartsState.fetus = true;
            foundPartsRefs.fetus = child;
            console.log('FetalModel3D: Found Fetus part in scene:', child.name);
          } else if (lowerName.includes('heart') || child.name === 'Heart') {
            heartRef.current = child;
            foundPartsState.heart = true;
            foundPartsRefs.heart = child;
            console.log('FetalModel3D: Found Heart part in scene:', child.name);
          }
        });
      }
      
      console.log('FetalModel3D: All nodes found:', allNodes);
      console.log('FetalModel3D: Found parts:', foundPartsState);
      
      // Store found parts for reference
      setFoundParts(foundPartsRefs);
      
      // If we didn't find the expected parts, try fallback approach
      if (!foundPartsState.womb || !foundPartsState.fetus || !foundPartsState.heart) {
        console.warn('FetalModel3D: Some expected parts not found:', foundPartsState);
        console.warn('FetalModel3D: Available node names:', allNodes.map(n => n.name).filter(n => n));
        console.warn('FetalModel3D: Try checking for variations of: Womb, Fetus, Heart');
        
        // Fallback: Use the first few meshes found if specific parts aren't identified
        const meshNodes = allNodes.filter(n => n.hasGeometry);
        console.log('FetalModel3D: Found mesh nodes for fallback:', meshNodes.map(n => n.name));
        
        if (!foundPartsState.womb && meshNodes.length > 0) {
          const fallbackWomb = scene ? scene.getObjectByProperty('uuid', meshNodes[0].uuid) : nodes[meshNodes[0].name];
          if (fallbackWomb) {
            wombRef.current = fallbackWomb;
            foundPartsRefs.womb = fallbackWomb;
            console.log('FetalModel3D: Using fallback womb:', meshNodes[0].name);
          }
        }
        
        if (!foundPartsState.fetus && meshNodes.length > 1) {
          const fallbackFetus = scene ? scene.getObjectByProperty('uuid', meshNodes[1].uuid) : nodes[meshNodes[1].name];
          if (fallbackFetus) {
            fetusRef.current = fallbackFetus;
            foundPartsRefs.fetus = fallbackFetus;
            console.log('FetalModel3D: Using fallback fetus:', meshNodes[1].name);
          }
        }
        
        if (!foundPartsState.heart && meshNodes.length > 2) {
          const fallbackHeart = scene ? scene.getObjectByProperty('uuid', meshNodes[2].uuid) : nodes[meshNodes[2].name];
          if (fallbackHeart) {
            heartRef.current = fallbackHeart;
            foundPartsRefs.heart = fallbackHeart;
            console.log('FetalModel3D: Using fallback heart:', meshNodes[2].name);
          }
        }
      }
    }
  }, [scene, nodes]);
  
  // Show loading state while scene is not ready
  if (!scene) {
    return (
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial color="white" />
      </mesh>
    );
  }
  
  return (
    <group ref={groupRef}>
      {/* Display the GLB model preserving original Blender positioning */}
      <primitive object={scene} />
      
      {/* Enhanced lighting for better visibility */}
      <ambientLight intensity={0.8} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1.2} 
        castShadow 
      />
      <directionalLight 
        position={[-10, -10, -5]} 
        intensity={0.8} 
      />
    </group>
  );
}

export default FetalModel3D;
