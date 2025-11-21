import { LoadingOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
    visible: boolean;
}

const LoadingSpinner = ({ visible }: LoadingSpinnerProps) => {
    if (!visible) return null;

    return (
        <div className="loading-spinner-overlay">
            <div className="loading-spinner-content">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
            </div>
        </div>
    );
};

export default LoadingSpinner;
