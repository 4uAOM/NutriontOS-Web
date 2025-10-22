document.addEventListener("DOMContentLoaded", () => {
  const sysOutput = document.getElementById("sys-output");

  const info = {
    OS: "NutriontOS v1.0",
    Kernel: "6.9.3-ntrn",
    Arch: "x86_64",
    Host: "nutriont-dev",
    Uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
    Memory: `${(Math.random() * 4 + 2).toFixed(1)} GB / 8 GB`,
    Packages: Math.floor(Math.random() * 400) + 300,
    Shell: "bash 5.3",
  };

  let output = "";
  for (let key in info) {
    output += `${key.padEnd(10)}: ${info[key]}\n`;
  }

  // Simulate typing effect for hacker-like precision
  let i = 0;
  const typeSpeed = 20;
  function type() {
    if (i < output.length) {
      sysOutput.textContent += output.charAt(i);
      i++;
      setTimeout(type, typeSpeed);
    }
  }

  type();
});