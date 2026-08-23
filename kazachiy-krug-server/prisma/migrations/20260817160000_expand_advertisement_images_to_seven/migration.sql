ALTER TABLE "public"."advertisement_images"
    DROP CONSTRAINT IF EXISTS "advertisement_images_sort_order_check";

ALTER TABLE "public"."advertisement_images"
    ADD CONSTRAINT "advertisement_images_sort_order_check"
    CHECK ("sortOrder" BETWEEN 0 AND 6);
