import { Alert } from "antd";

function ErrorView({ message, description }: { message: string, description: React.ReactNode }) {
    return (
        <Alert
            message={message}
            description={description}
            type="error"
            showIcon
            style={{ margin: "16px 0" }}
        />
    );
}

export default ErrorView;
