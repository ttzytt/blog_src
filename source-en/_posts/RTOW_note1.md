---
title: "Ray Tracing in One Weekend Study Notes (1): Lambertian Materials and Radiometry"
date: 2022-08-31 00:00:00
updated: 2022-09-06 23:37:20
tags:
- Radiometry
- Ray Tracing
- Computer Graphics
- RTOW
categories: Study Notes
keywords:
description:
top_img: "/img/光追/one_weekend/rand_scene.png"
comments:
cover: "/img/光追/one_weekend/rand_scene.png"
toc:
toc_number:
toc_style_simple:
copyright:
copyright_author:
copyright_author_href:
copyright_url:
copyright_info:
mathjax: 
katex: true
aplayer:
highlight_shrink:
aside:
---

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/RTOW_note1/).
{% endnote %}

~~Recently~~ (it has been a week since I finished RTOW, and I am only writing these notes now—truly lazy) I spent some time finishing *Ray Tracing in One Weekend* (hereafter RTOW) ~~I really am not good enough; I did not finish this thing in one weekend~~ and also wrote the code.

The book is excellent, and the final rendering was beyond my expectations (the cover image). However, I previously knew nothing about computer graphics, so many basic concepts were unfamiliar. The book sometimes passes over basic knowledge, mathematical derivations, and proofs, so I am writing down my own thought process here.

---

# Implementing a Lambertian Material

The book creates a Lambertian diffuse material as follows:

```cpp
class lambertian : public material {
   public:
    lambertian(const color& alb) : albedo(alb) {}
    virtual optional<pair<ray, color>> 
    get_ray_out(const ray& r_in, const hit_rec& rec) const override {
        vec3 ref_dir = rec.norm + rand_unit_vec(); // Note this line.
        if(ref_dir.near_zero()) // If rand_unit_vec() equals -rec.norm.
            ref_dir = rec.norm;
        ray ref_ray(rec.hit_pt, ref_dir);
        return make_pair(ref_ray, albedo);    
    }
    color albedo;  // Albedo.
};
```

After a ray hits a diffuse material, the scattered ray starts at the hit point (`rec.hit_pt`) and its direction is a random unit vector plus the normal at the hit point.

Why add the normal? Why not simply choose a random vector in a hemisphere?

## Radiometry

To answer this, we need some knowledge of radiometry. In ray tracing we care about the light received by a camera (or the human eye), so the explanation below uses the camera's perspective.

### Basic Units

The physical quantity received by a camera sensor is energy—the number of photons reaching it. This is radiant energy, denoted $Q$, measured in joules. Energy alone does not represent brightness well: photographing the same scene for one minute and for $1/100$ second clearly differs. Dividing received energy by collection time gives radiant flux:
$$\Phi=\frac{\mathrm dQ}{\mathrm dt}$$
the energy received per unit time.

For a larger sensor, more flux is received in the same time, although the object's brightness has not changed. Divide flux by area to obtain irradiance:
$$E=\frac{\mathrm d\Phi}{\mathrm dA}.$$

Likewise, a larger light source supplies more flux, but its flux per unit area is unchanged.

![](/img/光追/one_weekend/辐照度.png)

At a greater viewing distance, a larger area is needed to collect the same flux, so irradiance decreases. Yet distant objects do not visibly become much dimmer: they also occupy a smaller apparent area. These effects cancel, so we need solid angle to describe apparent size. Imagine the eye at the center of a sphere. Objects projected onto this sphere occupy an area proportional to their apparent size. Solid angle is the projected area on a unit sphere, measured in steradians:
$$\Omega=\frac a{R^2},$$
where $a$ is the projected area on a sphere of radius $R$.

Using solid angle, radiance describes perceived brightness:
$$L_\theta=\frac{\mathrm d\Phi}{\mathrm dA\cos(\theta)\mathrm d\Omega}.$$
Here $A$ is the sensor area. The cosine accounts for the area of the surface projected parallel to the sphere:
![](/img/光追/one_weekend/立体角_cos.png)

When $\theta=0$, $\mathrm dA\cos\theta$ is largest; when $\theta=\pi/2$, the surface is perpendicular to the sphere and the projected area is zero.

Radiance is enough for most surfaces, but a point light has no area. When area is irrelevant and we only want emitted or received flux in a direction, use radiant intensity:
$$I=\frac{\mathrm d\Phi}{\mathrm d\Omega}.$$

### Lambert's Cosine Law

![](/img/光追/one_weekend/朗伯余弦.png)

Mathematically:
$$I_\theta=I_n\times\cos\theta,$$
where $I_n$ is the intensity when the surface normal is parallel to the ray. The larger the angle between the observer's normal and the ray, the less flux is received. The cosine computes the area of the surface projected onto a plane **perpendicular to the ray**.

## Lambertian Materials and Diffuse Reflection

Wikipedia describes a Lambertian radiator as a source whose spatial intensity distribution follows the cosine law; its intensity decreases with angle. A Lambertian surface, however, has the same radiance from every viewing direction.

The definitions explain why these statements are consistent:
$$L_\theta=\frac{\mathrm d\Phi}{\mathrm dA\cos\theta\mathrm d\Omega},\qquad I_\theta=\frac{\mathrm d\Phi}{\mathrm d\Omega}\cos\theta.$$
Thus the cosine cancels between numerator and denominator for radiance. Intensity depends on angle, but radiance does not. From the observer's viewpoint, an oblique surface also appears smaller, which cancels the reduced flux.

## Why Is the Code Written This Way?

Ray tracing follows rays backwards, from the camera toward the light. A camera point $B$ may receive contributions from many rays leaving an object point $A$, so after tracing from $A$ to $B$ we must choose the next direction.

I understand this as tracing radiant intensity: each pixel has the same area, so its color depends on flux from a direction. Lambert's cosine law must therefore be considered when measuring the contribution to $B$.

The book samples each pixel repeatedly:
```cpp
……
color pixel_color(0, 0, 0);
for (int s = 0; s < samples_per_pixel; ++s) {
    auto u = (i + random_double()) / (image_width-1);
    auto v = (j + random_double()) / (image_height-1);
    ray r = cam.get_ray(u, v);
    pixel_color += ray_color(r, world);
}
write_color(std::cout, pixel_color, samples_per_pixel);
……
```

There are two ways to model the cosine attenuation. Choose a random direction on the unit hemisphere and multiply by the cosine of its angle with the normal:
![](/img/光追/one_weekend/朗伯光追反射_1.png)

Or use $\cos\theta$ as the probability density function for choosing directions, eliminating the explicit attenuation:
![](/img/光追/one_weekend/朗伯光追反射_2.png)

The book chooses the second method. If $\cos\theta$ is treated as the length of a segment making angle $\theta$ with the normal and one endpoint is fixed at $B$, the result is a circle tangent to $B$ (a sphere in three dimensions):
![](/img/光追/one_weekend/Lambert_Cosine_Law_1.svg.png)

I do not currently know how to prove this, but it is correct. RTOW uses it by adding the hit-point normal to a random unit vector:
```cpp
vec3 ref_dir = rec.norm + rand_unit_vec();
```

One remaining question is why the light received at $B$ is uniformly scattered around it. We are tracing radiant intensity, so should we calculate the angle between the surface normal and the camera and apply cosine attenuation?

![](/img/光追/one_weekend/朗伯体像素夹角.svg)

As the angle increases, the surface area corresponding to one pixel also increases, cancelling the cosine attenuation. Since each sample chooses an arbitrary position inside the pixel, repeated samples cover the surface corresponding to that pixel. If we explicitly applied cosine attenuation, we would likewise take more samples from regions with larger angles, because those regions cover a larger area.

[^1]: <http://www2.bren.ucsb.edu/~dturney/WebResources_13/RemoteSensing/TheLightHandbook.pdf>

References:
1. <https://www.cnblogs.com/ludwig1860/p/13930745.html>
2. <https://zh.wikipedia.org/zh-hans/%E4%BD%99%E5%BC%A6%E8%BE%90%E5%B0%84%E4%BD%93>
