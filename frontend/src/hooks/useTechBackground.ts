import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  size: number;
  color: string;
  update: () => void;
  draw: () => void;
}

interface Mouse {
  x: number | null;
  y: number | null;
  radius: number;
}

export const useTechBackground = (canvasRef: React.RefObject<HTMLCanvasElement>, isDark: boolean) => {
  const particlesArrayRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const mouseRef = useRef<Mouse>({ x: null, y: null, radius: 150 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Store references that TypeScript can understand as non-null
    const canvasElement: HTMLCanvasElement = canvas;
    const ctx2d: CanvasRenderingContext2D = ctx;

    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    class Particle {
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      size: number;
      color: string;

      constructor(x: number, y: number, directionX: number, directionY: number, size: number, color: string) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
      }

      draw() {
        ctx2d.beginPath();
        ctx2d.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx2d.fillStyle = this.color;
        ctx2d.fill();
      }

      update() {
        const mouse = mouseRef.current;
        if (mouse.x !== null && mouse.y !== null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            this.x -= (dx / distance) * force * 2;
            this.y -= (dy / distance) * force * 2;
          }
        }

        this.x += this.directionX;
        this.y += this.directionY;

        if (this.x > canvasElement.width) {
          this.x = canvasElement.width;
          this.directionX *= -1;
        } else if (this.x < 0) {
          this.x = 0;
          this.directionX *= -1;
        }
        if (this.y > canvasElement.height) {
          this.y = canvasElement.height;
          this.directionY *= -1;
        } else if (this.y < 0) {
          this.y = 0;
          this.directionY *= -1;
        }

        this.draw();
      }
    }

    const init = () => {
      particlesArrayRef.current = [];
      let numberOfParticles = (canvasElement.height * canvasElement.width) / 9000;
      for (let i = 0; i < numberOfParticles; i++) {
        let size = Math.random() * 2 + 1;
        let x = Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2;
        let y = Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2;
        let directionX = (Math.random() * 0.2) - 0.1;
        let directionY = (Math.random() * 0.2) - 0.1;
        let color = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0, 0, 0, 0.47)';
        particlesArrayRef.current.push(new Particle(x, y, directionX, directionY, size, color));
      }
    };

    const connect = () => {
      let opacityValue = 1;
      for (let a = 0; a < particlesArrayRef.current.length; a++) {
        for (let b = a; b < particlesArrayRef.current.length; b++) {
          let distance = 
            (particlesArrayRef.current[a].x - particlesArrayRef.current[b].x) * 
            (particlesArrayRef.current[a].x - particlesArrayRef.current[b].x) + 
            (particlesArrayRef.current[a].y - particlesArrayRef.current[b].y) * 
            (particlesArrayRef.current[a].y - particlesArrayRef.current[b].y);
          if (distance < (canvasElement.width / 7) * (canvasElement.height / 7)) {
            opacityValue = 1 - (distance / 20000);
            let color = isDark 
              ? `rgba(110, 180, 255, ${opacityValue})` 
              : `rgba(0, 50, 150, ${opacityValue})`;
             ctx2d.strokeStyle = color;
             ctx2d.lineWidth = 1;
             ctx2d.beginPath();
             ctx2d.moveTo(particlesArrayRef.current[a].x, particlesArrayRef.current[a].y);
             ctx2d.lineTo(particlesArrayRef.current[b].x, particlesArrayRef.current[b].y);
             ctx2d.stroke();
          }
        }
      }
    };

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      ctx2d.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = 0; i < particlesArrayRef.current.length; i++) {
        particlesArrayRef.current[i].update();
      }
      connect();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = event.x;
      mouseRef.current.y = event.y;
    };

    const handleMouseOut = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    const handleResize = () => {
      canvasElement.width = innerWidth;
      canvasElement.height = innerHeight;
      init();
    };

    // Initialize
    init();
    animate();

    // Event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef, isDark]);
};

