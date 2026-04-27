'use client';
import useSocket from '../hooks/useSocket';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Home() {
  const socket = useSocket("yatodharm tato jayah");
  const [logs, setLogs] = useState([]);
  const [runningCode, setRunningCode] = useState("");
  const [currentVersion, setCurrentVersion] = useState("Version 1.4.0 - Bug fixes");
  const [versionDetails, setVersionDetails] = useState("");
  const [randomCode, setRandomCode] = useState("");
 const router = useRouter();
 router.push("/auth/login");
  useEffect(() => {
    
    // Simulate receiving logs
    const interval = setInterval(() => {
      setLogs((prevLogs) => [
        `Connected to remote host: ${new Date().toLocaleTimeString()}`,
        `Executing command: nmap -sP 192.168.1.0/24`,
        `Scan result: ${Math.random() < 0.5 ? 'Device found: Laptop - IP: 192.168.1.10' : 'No devices found.'}`,
        `Security alert: Breach detected! Initiating response protocols...`,
        ...prevLogs
      ].slice(0, 15)); // Limit logs to the last 15 entries
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const codeLines = [
      "Initializing FBI Cyber Operations...",
      "Loading cybersecurity protocols...",
      "Establishing secure connection...",
      "Fetching target data...",
      "Running system vulnerability checks...",
      "Validating user access...",
      "Compiling attack vectors...",
      "Complete."
    ];
    
    let index = 0;
    const typingEffect = setInterval(() => {
      if (index < codeLines.length) {
        setRunningCode((prev) => prev + codeLines[index] + "\n");
        index++;
      } else {
        clearInterval(typingEffect);
      }
    }, 2000);
    
    return () => clearInterval(typingEffect);
  }, []);

  useEffect(() => {
    const versionActions = [
      "Analyzing target environment...",
      "Threat assessment complete.",
      "Current operation: " + currentVersion,
      "Monitoring network traffic...",
      "All systems operational. Ready for engagement."
    ];

    let index = 0;
    const versionEffect = setInterval(() => {
      if (index < versionActions.length) {
        setVersionDetails((prev) => prev + versionActions[index] + "\n");
        index++;
      } else {
        clearInterval(versionEffect);
      }
    }, 3000);
    
    return () => clearInterval(versionEffect);
  }, [currentVersion]);

  useEffect(() => {
    const generateRandomCode = () => {
      const codeSnippets = [
        "const user = { name: 'Agent Smith', id: 007 };",
        "function connectToServer() { console.log('Connecting...'); }",
        "let isConnected = false; while (!isConnected) { connectToServer(); }",
        "console.log('Security protocols initiated.');"
      ];
      setRandomCode(codeSnippets[Math.floor(Math.random() * codeSnippets.length)]);
    };

    const randomCodeInterval = setInterval(generateRandomCode, 5000);
    return () => clearInterval(randomCodeInterval);
  }, []);

  useEffect(() => {
    // Client-side only
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      /* Additional styles can be added here */
    `;
    document.head.appendChild(styleSheet);
    
    // Cleanup function to remove the style on unmount
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.versionInfo}>
        <h2 style={styles.versionTitle}>Current Operation:</h2>
        <p style={styles.versionText}>{currentVersion}</p>
        <pre style={styles.versionDetails}>{versionDetails}</pre>
      </div>

      <div style={styles.console}>
        <h3 style={styles.consoleTitle}>Command Line Interface</h3>
        <pre style={styles.runningCode}>{runningCode}</pre>
      </div>

      <div style={styles.logContainer}>
        <h3 style={styles.logTitle}>Activity Log</h3>
        {logs.map((log, index) => (
          <div key={index} style={styles.log}>
            {log}
          </div>
        ))}
      </div>

      <div style={styles.randomCodeBlock}>
        <h3 style={styles.randomCodeTitle}>Random Code Snippet</h3>
        <pre style={styles.randomCode}>{randomCode}</pre>
      </div>

      <div style={styles.hackerLook}>
        <h2 style={styles.hackerTitle}>FBI Cyber Operations</h2>
        <p style={styles.hackerText}>
          Welcome, Agent. You are now connected to the target system. Proceed with caution.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  versionInfo: {
    backgroundColor: '#161b22',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    animation: 'fadeIn 1s',
    flex: '1',
  },
  versionTitle: {
    color: '#50fa7b',
  },
  versionText: {
    fontSize: '1.5rem',
  },
  versionDetails: {
    whiteSpace: 'pre-wrap',
    color: '#8be9fd',
    margin: '0',
    fontFamily: 'monospace',
  },
  console: {
    backgroundColor: '#161b22',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    position: 'relative',
    animation: 'fadeIn 1s',
    flex: '1',
  },
  consoleTitle: {
    color: '#ff79c6',
  },
  runningCode: {
    whiteSpace: 'pre-wrap',
    margin: '0',
    color: '#f8f8f2',
    fontFamily: 'monospace',
    animation: 'fadeIn 2s',
    overflowY: 'auto',
    maxHeight: '150px',
  },
  logContainer: {
    backgroundColor: '#161b22',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    animation: 'fadeIn 1s',
    flex: '1',
    overflowY: 'auto',
    maxHeight: '150px',
  },
  logTitle: {
    color: '#50fa7b',
  },
  log: {
    borderBottom: '1px solid #30363d',
    padding: '5px',
    color: '#ff79c6',
  },
  randomCodeBlock: {
    backgroundColor: '#161b22',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    animation: 'fadeIn 1s',
    flex: '1',
  },
  randomCodeTitle: {
    color: '#50fa7b',
  },
  randomCode: {
    whiteSpace: 'pre-wrap',
    color: '#f8f8f2',
    fontFamily: 'monospace',
    overflowY: 'auto',
    maxHeight: '150px',
  },
  hackerLook: {
    backgroundColor: '#161b22',
    padding: '10px',
    borderRadius: '5px',
    color: '#c9d1d9',
    animation: 'fadeIn 1s',
  },
  hackerTitle: {
    color: '#50fa7b',
  },
  hackerText: {
    color: '#8be9fd',
  },
};
