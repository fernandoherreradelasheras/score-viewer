import { cloneElement } from "react";
import { Pagination } from "antd";
import { useTranslation } from "react-i18next";
import { FacsimileItem } from "../types";
import FacsimilePreview from "./FacsimilePreview";

interface FacsimilePaginationProps {
    path: string;
    items: FacsimileItem[];
    currentItem: number;
    onItemSelected: (item: number) => void;
    small?: boolean;
    style?: React.CSSProperties;
}

function FacsimilePagination({ path, items, currentItem, onItemSelected, small = false, style }: FacsimilePaginationProps) {
    const { t } = useTranslation("common");

    return <Pagination
        style={style}
        align="center"
        {...(small ? { size: "small" as const } : {})}
        current={currentItem + 1}
        defaultPageSize={1}
        total={items.length}
        simple={false}
        showTitle={false}
        itemRender={(page, type, element) => {
            if (type === 'page' && items[page - 1]) {
                return <FacsimilePreview
                    page={page}
                    name={items[page - 1].name}
                    src={path + items[page - 1].file}>{element}</FacsimilePreview>
            }
            if (type === 'prev' || type === 'next') {
                return cloneElement(element as React.ReactElement<{ title?: string }>,
                    { title: t(type === 'prev' ? 'pagination.previousPage' : 'pagination.nextPage') })
            }
            return element;
        }}
        onChange={page => onItemSelected(page - 1)} />
}

export default FacsimilePagination;
