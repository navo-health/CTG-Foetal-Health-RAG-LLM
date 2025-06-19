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
        script: "/home/ec2-user/CTG-Foetal-Health-RAG-LLM/Backend/venv/bin/python3",
        args: "app.py",
        watch: true
      }
    ]
  }  