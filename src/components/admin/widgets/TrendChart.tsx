'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

interface TrendChartProps {
  title: string;
  labels: string[];
  data: number[];
  type?: 'line' | 'bar';
  borderColor?: string;
  backgroundColor?: string;
}

export default function TrendChart({
  title,
  labels,
  data,
  type = 'line',
  borderColor = 'rgb(99, 102, 241)',
  backgroundColor = 'rgba(99, 102, 241, 0.5)',
}: TrendChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data,
        borderColor,
        backgroundColor,
        tension: 0.3,
        fill: type === 'line',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        align: 'start' as const,
        color: '#0f172a',
        font: { size: 13, weight: 600 as const },
      },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      {type === 'bar' ? <Bar data={chartData} options={options} /> : <Line data={chartData} options={options} />}
    </div>
  );
}
