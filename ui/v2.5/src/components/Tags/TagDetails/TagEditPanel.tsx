import React, { useEffect } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import * as yup from "yup";
import { DetailsEditNavbar } from "src/components/Shared/DetailsEditNavbar";
import { TagSelect } from "src/components/Shared/Select";
import { Form, Col, Row } from "react-bootstrap";
import FormUtils from "src/utils/form";
import ImageUtils from "src/utils/image";
import { useFormik } from "formik";
import { Prompt } from "react-router-dom";
import Mousetrap from "mousetrap";
import { StringListInput } from "src/components/Shared/StringListInput";
import isEqual from "lodash-es/isEqual";

interface ITagEditPanel {
  tag: Partial<GQL.TagDataFragment>;
  // returns id
  onSubmit: (tag: GQL.TagCreateInput) => void;
  onCancel: () => void;
  onDelete: () => void;
  setImage: (image?: string | null) => void;
  setEncodingImage: (loading: boolean) => void;
}

export const TagEditPanel: React.FC<ITagEditPanel> = ({
  tag,
  onSubmit,
  onCancel,
  onDelete,
  setImage,
  setEncodingImage,
}) => {
  const intl = useIntl();

  const isNew = tag.id === undefined;

  const labelXS = 3;
  const labelXL = 3;
  const fieldXS = 9;
  const fieldXL = 9;

  const schema = yup.object({
    name: yup.string().required(),
    aliases: yup
      .array(yup.string().required())
      .defined()
      .test({
        name: "unique",
        test: (value, context) => {
          const aliases = [context.parent.name, ...value];
          const dupes = aliases
            .map((e, i, a) => {
              if (a.indexOf(e) !== i) {
                return String(i - 1);
              } else {
                return null;
              }
            })
            .filter((e) => e !== null) as string[];
          if (dupes.length === 0) return true;
          return new yup.ValidationError(dupes.join(" "), value, "aliases");
        },
      }),
    description: yup.string().ensure(),
    parent_ids: yup.array(yup.string().required()).defined(),
    child_ids: yup.array(yup.string().required()).defined(),
    ignore_auto_tag: yup.boolean().defined(),
    image: yup.string().nullable().optional(),
  });

  const initialValues = {
    name: tag?.name ?? "",
    aliases: tag?.aliases ?? [],
    description: tag?.description ?? "",
    parent_ids: (tag?.parents ?? []).map((t) => t.id),
    child_ids: (tag?.children ?? []).map((t) => t.id),
    ignore_auto_tag: tag?.ignore_auto_tag ?? false,
  };

  type InputValues = yup.InferType<typeof schema>;

  const formik = useFormik<InputValues>({
    initialValues,
    validationSchema: schema,
    enableReinitialize: true,
    onSubmit: (values) => onSubmit(values),
  });

  function onCancelEditing() {
    setImage(undefined);
    onCancel?.();
  }

  // set up hotkeys
  useEffect(() => {
    Mousetrap.bind("s s", () => formik.handleSubmit());

    return () => {
      Mousetrap.unbind("s s");
    };
  });

  const encodingImage = ImageUtils.usePasteImage(onImageLoad);

  useEffect(() => {
    setImage(formik.values.image);
  }, [formik.values.image, setImage]);

  useEffect(() => {
    setEncodingImage(encodingImage);
  }, [setEncodingImage, encodingImage]);

  function onImageLoad(imageData: string | null) {
    formik.setFieldValue("image", imageData);
  }

  function onImageChange(event: React.FormEvent<HTMLInputElement>) {
    ImageUtils.onImageChange(event, onImageLoad);
  }

  const aliasErrors = Array.isArray(formik.errors.aliases)
    ? formik.errors.aliases[0]
    : formik.errors.aliases;
  const aliasErrorMsg = aliasErrors
    ? intl.formatMessage({ id: "validation.aliases_must_be_unique" })
    : undefined;
  const aliasErrorIdx = aliasErrors?.split(" ").map((e) => parseInt(e));

  const isEditing = true;

  // TODO: CSS class
  return (
    <div>
      {isNew && (
        <h2>
          <FormattedMessage
            id="actions.add_entity"
            values={{ entityType: intl.formatMessage({ id: "tag" }) }}
          />
        </h2>
      )}

      <Prompt
        when={formik.dirty}
        message={(location, action) => {
          // Check if it's a redirect after movie creation
          if (action === "PUSH" && location.pathname.startsWith("/tags/")) {
            return true;
          }
          return intl.formatMessage({ id: "dialogs.unsaved_changes" });
        }}
      />

      <Form noValidate onSubmit={formik.handleSubmit} id="tag-edit">
        <Form.Group controlId="name" as={Row}>
          <Form.Label column xs={labelXS} xl={labelXL}>
            <FormattedMessage id="name" />
          </Form.Label>
          <Col xs={fieldXS} xl={fieldXL}>
            <Form.Control
              className="text-input"
              placeholder={intl.formatMessage({ id: "name" })}
              {...formik.getFieldProps("name")}
              isInvalid={!!formik.errors.name}
            />
            <Form.Control.Feedback type="invalid">
              {formik.errors.name}
            </Form.Control.Feedback>
          </Col>
        </Form.Group>

        <Form.Group controlId="aliases" as={Row}>
          <Form.Label column xs={labelXS} xl={labelXL}>
            <FormattedMessage id="aliases" />
          </Form.Label>
          <Col xs={fieldXS} xl={fieldXL}>
            <StringListInput
              value={formik.values.aliases}
              setValue={(value) => formik.setFieldValue("aliases", value)}
              errors={aliasErrorMsg}
              errorIdx={aliasErrorIdx}
            />
          </Col>
        </Form.Group>

        <Form.Group controlId="description" as={Row}>
          {FormUtils.renderLabel({
            title: intl.formatMessage({ id: "description" }),
          })}
          <Col xs={9}>
            <Form.Control
              as="textarea"
              className="text-input"
              placeholder={intl.formatMessage({ id: "description" })}
              {...formik.getFieldProps("description")}
            />
          </Col>
        </Form.Group>

        <Form.Group controlId="parent_tags" as={Row}>
          {FormUtils.renderLabel({
            title: intl.formatMessage({ id: "parent_tags" }),
            labelProps: {
              column: true,
              sm: 3,
              xl: 12,
            },
          })}
          <Col sm={9} xl={12}>
            <TagSelect
              isMulti
              onSelect={(items) =>
                formik.setFieldValue(
                  "parent_ids",
                  items.map((item) => item.id)
                )
              }
              ids={formik.values.parent_ids}
              excludeIds={[
                ...(tag?.id ? [tag.id] : []),
                ...formik.values.child_ids,
              ]}
              creatable={false}
            />
          </Col>
        </Form.Group>

        <Form.Group controlId="sub_tags" as={Row}>
          {FormUtils.renderLabel({
            title: intl.formatMessage({ id: "sub_tags" }),
            labelProps: {
              column: true,
              sm: 3,
              xl: 12,
            },
          })}
          <Col sm={9} xl={12}>
            <TagSelect
              isMulti
              onSelect={(items) =>
                formik.setFieldValue(
                  "child_ids",
                  items.map((item) => item.id)
                )
              }
              ids={formik.values.child_ids}
              excludeIds={[
                ...(tag?.id ? [tag.id] : []),
                ...formik.values.parent_ids,
              ]}
              creatable={false}
            />
          </Col>
        </Form.Group>

        <hr />

        <Form.Group controlId="ignore-auto-tag" as={Row}>
          <Form.Label column xs={labelXS} xl={labelXL}>
            <FormattedMessage id="ignore_auto_tag" />
          </Form.Label>
          <Col xs={fieldXS} xl={fieldXL}>
            <Form.Check
              {...formik.getFieldProps({
                name: "ignore_auto_tag",
                type: "checkbox",
              })}
            />
          </Col>
        </Form.Group>
      </Form>

      <DetailsEditNavbar
        objectName={tag?.name ?? intl.formatMessage({ id: "tag" })}
        isNew={isNew}
        isEditing={isEditing}
        onToggleEdit={onCancelEditing}
        onSave={formik.handleSubmit}
        saveDisabled={(!isNew && !formik.dirty) || !isEqual(formik.errors, {})}
        onImageChange={onImageChange}
        onImageChangeURL={onImageLoad}
        onClearImage={() => onImageLoad(null)}
        onDelete={onDelete}
        acceptSVG
      />
    </div>
  );
};
