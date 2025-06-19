module.exports = {
    apps: [
      {
        name: "frontend",
        cwd: "./frontend",
        script: "npm",
        args: "run start",
        watch: true
      },
      {
        name: "backend",
        cwd: "./Backend",
        script: "app.py",
        interpreter: "venv/bin/python3",
        watch: true
      }
    ]
  }  